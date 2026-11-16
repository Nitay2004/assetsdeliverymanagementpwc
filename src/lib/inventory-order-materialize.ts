import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEPLOYED_STATUSES } from "@/lib/inventory-status";

// Bulk Excel imports only create InventoryItem rows. The stage modules
// (Warehouse, Provisioning, Finance, Logistics) are driven by Order records, so
// those assets never appear there even when the sheet already says they were
// dispatched or delivered.
//
// This module closes that gap: it finds delivered inventory rows that are not
// linked to any order yet and materialises one Order per consignment (docket
// number, falling back to DC number, falling back to the asset itself), with an
// Asset link for every unit. It never edits inventory values and it skips any
// item that already has an Asset link, so running it again cannot duplicate an
// order.

// What counts as "delivered or already out with a user" in the inventory sheet.
// Kept as an OR because the source files use different columns: some rows carry
// a status, some a tracking text, some only a delivery date.
const DELIVERY_EVIDENCE_OR: Prisma.InventoryItemWhereInput[] = [
  { status: { in: DEPLOYED_STATUSES } },
  { trackingStatus: { contains: "deliver", mode: "insensitive" } },
  { latestTrackingStatus: { contains: "deliver", mode: "insensitive" } },
  { actualDeliveryDate: { not: null } },
  { latestDeliveryDate: { not: null } },
  { deliveryDate: { not: null } },
];

// Everything the Logistics "Delivered in Inventory" card counts.
export const DELIVERED_INVENTORY_WHERE: Prisma.InventoryItemWhereInput = {
  OR: DELIVERY_EVIDENCE_OR,
};

// The subset that still has no order, i.e. the work the sync button will do.
export const UNSYNCED_DELIVERED_INVENTORY_WHERE: Prisma.InventoryItemWhereInput = {
  AND: [{ assets: { none: {} } }, { OR: DELIVERY_EVIDENCE_OR }],
};

// Placeholder docket/DC values seen in the Excel sheets. "0" alone accounts for
// a couple of dozen unrelated assets, so treating it as a real consignment
// reference would merge them into one bogus order.
const JUNK_CONSIGNMENT_REFERENCE = "^(0+|-+|n/?a|null|nil|none|unknown)$";

// DEPLOYED_STATUSES is a compile-time constant, so it is safe to inline as a
// literal list. That keeps the raw query free of enum parameter inference.
const DEPLOYED_STATUS_SQL = DEPLOYED_STATUSES.map(
  status => `'${status.replace(/'/g, "''")}'`,
).join(", ");

interface AggregateGroupRow {
  group_key: string;
  item_ids: string[];
  entity: string | null;
  delivered_location: string | null;
  city: string | null;
  state: string | null;
  shipping_address: string | null;
  invoicing_warehouse: string | null;
  from_warehouse_location: string | null;
  engineer_name: string | null;
  latest_courier_name: string | null;
  partner: string | null;
  vendor: string | null;
  eway_bill_number: string | null;
  has_delivery_evidence: boolean;
  docket_number: string | null;
  dc_number: string | null;
}

interface GroupSummary {
  clientName: string;
  deliveryLocation: string;
  status: "DELIVERED" | "DISPATCHED";
  warehouseLocation: string | null;
  engineerName: string | null;
  courierName: string | null;
  ewayBillNumber: string | null;
}

interface ConsignmentGroup {
  key: string;
  docketNumber: string | null;
  dcNumber: string | null;
  itemIds: string[];
  summary: GroupSummary;
}

export interface MaterializeResult {
  dryRun: boolean;
  totalPending: number;
  groupsSelected: number;
  ordersCreated: number;
  assetsCreated: number;
  docketsCreated: number;
  remaining: number;
  skippedGroups: number;
  preview: {
    key: string;
    docketNumber: string | null;
    dcNumber: string | null;
    serialNumbers: string[];
    status: "DELIVERED" | "DISPATCHED";
    clientName: string;
    deliveryLocation: string;
  }[];
}

// One transaction carries this many consignments. 400 keeps the INSERT
// parameter count comfortably below PostgreSQL's limit while still amortising
// the round trips over thousands of backfilled orders.
const APPLY_CHUNK_SIZE = 400;
const DEFAULT_MAX_GROUPS = 5000;

function summariseGroup(row: AggregateGroupRow): GroupSummary {
  const cityState = [row.city, row.state].filter(Boolean).join(", ");
  return {
    clientName: row.entity ?? "PWC",
    deliveryLocation:
      row.delivered_location ?? (cityState || null) ?? row.shipping_address ?? "N/A",
    status: row.has_delivery_evidence ? "DELIVERED" : "DISPATCHED",
    warehouseLocation: row.invoicing_warehouse ?? row.from_warehouse_location,
    engineerName: row.engineer_name,
    courierName: row.latest_courier_name ?? row.partner ?? row.vendor,
    ewayBillNumber: row.eway_bill_number,
  };
}

function toConsignmentGroup(row: AggregateGroupRow): ConsignmentGroup {
  return {
    key: row.group_key,
    docketNumber: row.docket_number,
    dcNumber: row.dc_number,
    itemIds: row.item_ids,
    summary: summariseGroup(row),
  };
}

/**
 * Creates Orders for delivered inventory rows that have no order yet.
 *
 * `dryRun` returns the preview without writing anything. The real run caps how
 * many consignments it handles in one request so a large backlog cannot time
 * the server action out; the caller can run it again and `remaining` shows how
 * much is left.
 */
export async function materializeDeliveredInventoryOrders(options?: {
  dryRun?: boolean;
  maxGroups?: number;
}): Promise<MaterializeResult> {
  const dryRun = options?.dryRun ?? false;
  const maxGroups = Math.max(1, Math.min(10000, options?.maxGroups ?? DEFAULT_MAX_GROUPS));

  const totalPending = await prisma.inventoryItem.count({
    where: UNSYNCED_DELIVERED_INVENTORY_WHERE,
  });

  const emptyResult: MaterializeResult = {
    dryRun,
    totalPending,
    groupsSelected: 0,
    ordersCreated: 0,
    assetsCreated: 0,
    docketsCreated: 0,
    remaining: totalPending,
    skippedGroups: 0,
    preview: [],
  };

  if (totalPending === 0) return emptyResult;

  // Group inside PostgreSQL. Pulling ~9k full inventory rows through the
  // Supabase pooler was dropping the connection; this returns one row per
  // consignment instead. Summary fields use MAX rather than an ordered
  // array_agg on purpose: a docket groups units of the same consignment, so the
  // values are identical across its rows, while 15 ordered aggregates per group
  // took ~75s instead of ~0.6s.
  const sql = `
    WITH candidates AS (
      SELECT
        i.id,
        i.created_at,
        COALESCE(
          NULLIF(BTRIM(i.latest_docket_number), ''),
          NULLIF(BTRIM(i.docket_number), '')
        ) AS raw_docket,
        COALESCE(
          NULLIF(BTRIM(i.latest_dc), ''),
          NULLIF(BTRIM(i.dc_number), '')
        ) AS raw_dc,
        i.tracking_status,
        i.latest_tracking_status,
        i.actual_delivery_date,
        i.latest_delivery_date,
        i.delivery_date,
        i.entity,
        i.delivered_location,
        i.city,
        i.state,
        i.shipping_address,
        i.invoicing_warehouse,
        i.from_warehouse_location,
        i.engineer_name,
        i.latest_courier_name,
        i.partner,
        i.vendor,
        i.eway_bill,
        i.latest_eway_bill
      FROM inventory_items i
      WHERE NOT EXISTS (
          SELECT 1 FROM assets a WHERE a.inventory_item_id = i.id
        )
        AND (
          i.status IN (${DEPLOYED_STATUS_SQL})
          OR i.tracking_status ILIKE '%deliver%'
          OR i.latest_tracking_status ILIKE '%deliver%'
          OR i.actual_delivery_date IS NOT NULL
          OR i.latest_delivery_date IS NOT NULL
          OR i.delivery_date IS NOT NULL
        )
    ),
    normalized AS (
      SELECT
        c.*,
        CASE
          WHEN c.raw_docket !~* '${JUNK_CONSIGNMENT_REFERENCE}' THEN c.raw_docket
        END AS docket_number,
        CASE
          WHEN c.raw_dc !~* '${JUNK_CONSIGNMENT_REFERENCE}' THEN c.raw_dc
        END AS dc_number
      FROM candidates c
    )
    SELECT
      CASE
        WHEN docket_number IS NOT NULL THEN 'docket:' || UPPER(docket_number)
        WHEN dc_number IS NOT NULL THEN 'dc:' || UPPER(dc_number)
        ELSE 'item:' || id::text
      END AS group_key,
      array_agg(id::text) AS item_ids,
      MAX(NULLIF(BTRIM(entity), '')) AS entity,
      MAX(NULLIF(BTRIM(delivered_location), '')) AS delivered_location,
      MAX(NULLIF(BTRIM(city), '')) AS city,
      MAX(NULLIF(BTRIM(state), '')) AS state,
      MAX(NULLIF(BTRIM(shipping_address), '')) AS shipping_address,
      MAX(NULLIF(BTRIM(invoicing_warehouse), '')) AS invoicing_warehouse,
      MAX(NULLIF(BTRIM(from_warehouse_location), '')) AS from_warehouse_location,
      MAX(NULLIF(BTRIM(engineer_name), '')) AS engineer_name,
      MAX(NULLIF(BTRIM(latest_courier_name), '')) AS latest_courier_name,
      MAX(NULLIF(BTRIM(partner), '')) AS partner,
      MAX(NULLIF(BTRIM(vendor), '')) AS vendor,
      MAX(NULLIF(BTRIM(COALESCE(latest_eway_bill, eway_bill)), '')) AS eway_bill_number,
      BOOL_OR(
        tracking_status ILIKE '%deliver%'
        OR latest_tracking_status ILIKE '%deliver%'
        OR actual_delivery_date IS NOT NULL
        OR latest_delivery_date IS NOT NULL
        OR delivery_date IS NOT NULL
      ) AS has_delivery_evidence,
      MAX(docket_number) AS docket_number,
      MAX(dc_number) AS dc_number
    FROM normalized
    GROUP BY group_key
    ORDER BY MIN(created_at), group_key
  `;
  const rows = await prisma.$queryRawUnsafe<AggregateGroupRow[]>(sql);

  const groups = rows.slice(0, maxGroups).map(toConsignmentGroup);

  if (dryRun) {
    const previewGroups = groups.slice(0, 25);
    const previewIds = previewGroups.flatMap(group => group.itemIds);
    const serialRows = previewIds.length
      ? await prisma.inventoryItem.findMany({
          where: { id: { in: previewIds } },
          select: { id: true, serialNumber: true },
        })
      : [];
    const serialById = new Map(serialRows.map(row => [row.id, row.serialNumber]));

    return {
      ...emptyResult,
      groupsSelected: groups.length,
      remaining: totalPending,
      preview: previewGroups.map(group => ({
        key: group.key,
        docketNumber: group.docketNumber,
        dcNumber: group.dcNumber,
        serialNumbers: group.itemIds.map(id => serialById.get(id) ?? ""),
        status: group.summary.status,
        clientName: group.summary.clientName,
        deliveryLocation: group.summary.deliveryLocation,
      })),
    };
  }

  // Docket and e-way numbers are unique across the whole table. Collect what is
  // already taken up front so the backfill never aborts on a collision with an
  // order that was created through the normal flow.
  const docketNumbers = groups
    .map(group => group.docketNumber)
    .filter((n): n is string => Boolean(n));
  const ewayNumbers = groups
    .map(group => group.summary.ewayBillNumber)
    .filter((n): n is string => Boolean(n));

  const [existingDockets, existingEwayBills] = await Promise.all([
    docketNumbers.length
      ? prisma.docket.findMany({
          where: { docketNumber: { in: docketNumbers } },
          select: { docketNumber: true },
        })
      : Promise.resolve([]),
    ewayNumbers.length
      ? prisma.docket.findMany({
          where: { ewayBillNumber: { in: ewayNumbers } },
          select: { ewayBillNumber: true },
        })
      : Promise.resolve([]),
  ]);

  const takenDocketNumbers = new Set(existingDockets.map(d => d.docketNumber));
  const takenEwayNumbers = new Set(existingEwayBills.map(d => d.ewayBillNumber));

  let ordersCreated = 0;
  let assetsCreated = 0;
  let docketsCreated = 0;
  let skippedGroups = 0;

  for (let offset = 0; offset < groups.length; offset += APPLY_CHUNK_SIZE) {
    const chunk = groups.slice(offset, offset + APPLY_CHUNK_SIZE);
    const chunkItemIds = chunk.flatMap(group => group.itemIds);

    const created = await prisma.$transaction(async tx => {
      // Re-check and lock inside the transaction: a second operator clicking the
      // button at the same time must not create a duplicate order for the same
      // physical units.
      await tx.$queryRaw`
        SELECT id FROM inventory_items
        WHERE id IN (${Prisma.join(chunkItemIds)})
        FOR UPDATE
      `;

      const freeRows = await tx.inventoryItem.findMany({
        where: { id: { in: chunkItemIds }, assets: { none: {} } },
        select: { id: true },
      });
      const freeIds = new Set(freeRows.map(r => r.id));

      // Only take whole consignments. A partially linked group would otherwise
      // produce an order that silently misses some of its units.
      const usable = chunk.filter(group => group.itemIds.every(id => freeIds.has(id)));

      if (usable.length === 0) {
        return { orders: 0, assets: 0, dockets: 0, skipped: chunk.length };
      }

      const orderRows: Prisma.OrderCreateManyInput[] = usable.map(group => ({
        id: randomUUID(),
        clientName: group.summary.clientName,
        intermediary: "HP",
        totalQuantity: group.itemIds.length,
        deliveryLocation: group.summary.deliveryLocation,
        status: group.summary.status,
        warehouseLocation: group.summary.warehouseLocation,
        engineerName: group.summary.engineerName,
        dcNumber: group.dcNumber,
      }));

      await tx.order.createMany({ data: orderRows });

      const assetRows: Prisma.AssetCreateManyInput[] = [];
      const docketRows: Prisma.DocketCreateManyInput[] = [];

      usable.forEach((group, index) => {
        const orderId = orderRows[index].id!;
        for (const itemId of group.itemIds) {
          assetRows.push({
            id: randomUUID(),
            orderId,
            inventoryItemId: itemId,
            status: "allocated",
          });
        }

        if (group.docketNumber && !takenDocketNumbers.has(group.docketNumber)) {
          const ewayBillNumber =
            group.summary.ewayBillNumber && !takenEwayNumbers.has(group.summary.ewayBillNumber)
              ? group.summary.ewayBillNumber
              : null;

          docketRows.push({
            id: randomUUID(),
            orderId,
            docketNumber: group.docketNumber,
            courierName: group.summary.courierName,
            ewayBillNumber,
          });
          takenDocketNumbers.add(group.docketNumber);
          if (ewayBillNumber) takenEwayNumbers.add(ewayBillNumber);
        }
      });

      if (assetRows.length) await tx.asset.createMany({ data: assetRows });
      // skipDuplicates protects against a docket number that another request
      // inserted between the pre-check and this chunk.
      const docketResult = docketRows.length
        ? await tx.docket.createMany({ data: docketRows, skipDuplicates: true })
        : { count: 0 };

      return {
        orders: orderRows.length,
        assets: assetRows.length,
        dockets: docketResult.count,
        skipped: chunk.length - usable.length,
      };
    }, { timeout: 120000 });

    ordersCreated += created.orders;
    assetsCreated += created.assets;
    docketsCreated += created.dockets;
    skippedGroups += created.skipped;
  }

  const remaining = await prisma.inventoryItem.count({
    where: UNSYNCED_DELIVERED_INVENTORY_WHERE,
  });

  return {
    dryRun,
    totalPending,
    groupsSelected: groups.length,
    ordersCreated,
    assetsCreated,
    docketsCreated,
    remaining,
    skippedGroups,
    preview: [],
  };
}
