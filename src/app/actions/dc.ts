"use server";

import { prisma } from "@/lib/prisma";
import { getSession, requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { syncOrderTrackingStatus } from "@/lib/order-sync";
import { nextSequenceNumber } from "@/lib/sequence-number";
import { withUniqueRetry } from "@/lib/retry";
import { isIntraStateSupply } from "@/lib/dc-gst";
import { DOCKET_EDITABLE_STATUSES } from "@/lib/order-status";
import { parseDateOnlyUtc, todayDateOnlyUtc } from "@/lib/date-only";

function numberToWords(num: number): string {
  if (num === 0) return "Zero";

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertBelow1000(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convertBelow1000(n % 100) : "");
  }

  function convertBelow10000000(n: number): string {
    if (n < 1000) return convertBelow1000(n);
    if (n < 100000) return convertBelow1000(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + convertBelow1000(n % 1000) : "");
    if (n < 10000000) return convertBelow1000(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + convertBelow1000(n % 1000) : "");
    return "";
  }

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const remainder = num % 1000;

  let result = "";
  if (crore > 0) result += convertBelow1000(crore) + " Crore ";
  if (lakh > 0) result += convertBelow1000(lakh) + " Lakh ";
  if (thousand > 0) result += convertBelow1000(thousand) + " Thousand ";
  if (remainder > 0) result += convertBelow1000(remainder);

  return result.trim();
}

export async function getNextDcNumber(): Promise<string> {
  await requireAuth();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  let fyStart = year;
  if (month < 4) {
    fyStart = year - 1;
  }
  const shortYear = fyStart % 100;
  const nextShortYear = (fyStart + 1) % 100;
  const fy = `${String(shortYear).padStart(2, "0")}-${String(nextShortYear).padStart(2, "0")}`;

  const nextSeq = await nextSequenceNumber({
    table: "delivery_challans",
    column: "dc_number",
    valuePattern: new RegExp(`^DC-PDH-([0-9]+)-${String(shortYear).padStart(2,"0")}-${String(nextShortYear).padStart(2,"0")}$`),
  });

  return `DC-PDH-${String(nextSeq).padStart(4, "0")}-${fy}`;
}

export async function getWarehouses() {
  await requireAuth();
  return prisma.warehouse.findMany({ orderBy: { name: "asc" } });
}

export async function createWarehouse(name: string, location?: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canCreate");
  return prisma.warehouse.create({ data: { name, location } });
}

export async function deleteWarehouse(id: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canDelete");

  // delivery_challans.warehouse_id and rto_records.warehouse_id are
  // onDelete: SetNull, so the old P2003 catch never fired and the delete always
  // succeeded — silently detaching historical documents from their warehouse.
  // Block it outright when the warehouse is referenced.
  const [dcCount, rtoCount] = await Promise.all([
    prisma.deliveryChallan.count({ where: { warehouseId: id } }),
    prisma.rtoRecord.count({ where: { warehouseId: id } }),
  ]);
  if (dcCount > 0 || rtoCount > 0) {
    throw new Error("Cannot delete warehouse: it is linked to existing DCs or RTO records.");
  }

  try {
    await prisma.warehouse.delete({ where: { id } });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2003") {
      throw new Error("Cannot delete warehouse: it is linked to existing DCs.");
    }
    throw err;
  }
  revalidatePath("/dashboard/finance");
  return { ok: true };
}

export interface DcFormData {
  warehouseId?: string;
  warehouseLocation?: string;
  shipToLocation: string;
  billToLocation: string;
  modeOfPayment: string;
  referenceNo: string;
  referenceDate?: string;
  otherReferences: string;
  buyersOrderNo: string;
  buyersOrderDate?: string;
  dispatchDocNo: string;
  dispatchedThrough: string;
  destination: string;
  termsOfDelivery: string;
  items: {
    description: string;
    hsnSac: string;
    quantity: number;
    rate: number;
  }[];
}

export async function generateDC(orderId: string, data: DcFormData) {
  const user = await getSession();
  requirePermission(user, "finance", "canCreate");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      assets: {
        include: { inventoryItem: true },
      },
    },
  });
  if (!order) throw new Error("Order not found");

  const isRto = order.status === "RTO_DC_REQUESTED";

  // A DC is only generated at the two lifecycle points that call for one. This
  // stops a client from generating a DC for (and thereby advancing) an order
  // that is already dispatched, delivered, cancelled, etc.
  if (!isRto && order.status !== "IN_PROVISIONING" && order.status !== "DC_REQUESTED") {
    throw new Error("A DC can only be generated while the order is in provisioning or has requested one.");
  }

  // Guard against a second forward DC silently superseding the first one. RTO
  // DCs are a separate document on the same order, so they are exempt.
  if (!isRto) {
    const existingDc = await prisma.deliveryChallan.findFirst({
      where: { orderId },
      select: { dcNumber: true },
    });
    if (existingDc) {
      throw new Error(`A delivery challan (${existingDc.dcNumber}) already exists for this order.`);
    }
  }

  const targetStatus = isRto ? "RTO_DC_GENERATED" : "DC_GENERATED";
  const trackingStatus = isRto ? "RTO_DC_GENERATED" : "DC_GENERATED";

  // Every line has to be a real consignment line. Rejecting bad quantities and
  // rates here stops a NaN or negative value from corrupting the stored taxable
  // value and tax totals.
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("At least one item is required.");
  }
  for (const [index, item] of data.items.entries()) {
    if (!item.description?.trim()) {
      throw new Error(`Item ${index + 1}: description is required.`);
    }
    if (!Number.isFinite(item.quantity) || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error(`Item ${index + 1}: quantity must be a whole number of at least 1.`);
    }
    if (!Number.isFinite(item.rate) || item.rate < 0) {
      throw new Error(`Item ${index + 1}: rate must be a non-negative number.`);
    }
  }

  const dcDate = todayDateOnlyUtc();

  // Product Master stays the source of truth for the HSN and GST rate
  const hsnByModel: Record<string, string> = {};
  const gstRateByModel: Record<string, number> = {};
  for (const a of order.assets) {
    if (!a.inventoryItem) continue;
    const modelKey = (a.inventoryItem.model || "").trim().toLowerCase();
    if (modelKey && hsnByModel[modelKey] === undefined) {
      hsnByModel[modelKey] = (await lookupProductHsn(a.inventoryItem.partNo, a.inventoryItem.model)) ?? "";
    }
    if (modelKey && gstRateByModel[modelKey] === undefined) {
      const pm = await prisma.productMaster.findFirst({
        where: a.inventoryItem.partNo
          ? { partNo: { equals: a.inventoryItem.partNo, mode: "insensitive" } }
          : { model: { equals: a.inventoryItem.model, mode: "insensitive" } },
        select: { gstRate: true },
      });
      if (pm?.gstRate != null) {
        gstRateByModel[modelKey] = Number(pm.gstRate);
      }
    }
  }

  // Determine if intra-state or inter-state
  const isIntraState = isIntraStateSupply(
    data.warehouseLocation || order.warehouseLocation,
    data.shipToLocation || order.deliveryLocation
  );

  const items = await Promise.all(
    data.items.map(async (item) => {
      const amount = item.quantity * item.rate;
      const taxableValue = amount;
      const key = (item.description || "").trim().toLowerCase();
      const hsnSac = item.hsnSac || hsnByModel[key] || "";
      let gstRate = gstRateByModel[key];
      if (gstRate == null && hsnSac) {
        const pm = await prisma.productMaster.findFirst({
          where: { hsnCode: { equals: hsnSac, mode: "insensitive" } },
          select: { gstRate: true },
        });
        if (pm?.gstRate != null) gstRate = Number(pm.gstRate);
      }
      if (gstRate == null) gstRate = 18;
      return {
        ...item,
        hsnSac,
        amount,
        taxableValue,
        gstRate,
      };
    })
  );

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
  const totalTaxableValue = items.reduce((sum, i) => sum + i.taxableValue, 0);

  let totalIgstAmount = 0;
  let totalCgstAmount = 0;
  let totalSgstAmount = 0;
  const computedItems = items.map((item) => {
    const gstRate = item.gstRate || 18;
    if (isIntraState) {
      const cgstRate = gstRate / 2;
      const sgstRate = gstRate / 2;
      const cgstAmount = item.taxableValue * (cgstRate / 100);
      const sgstAmount = item.taxableValue * (sgstRate / 100);
      totalCgstAmount += cgstAmount;
      totalSgstAmount += sgstAmount;
      return {
        ...item,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate: null,
        igstAmount: 0,
      };
    } else {
      const igstRate = gstRate;
      const igstAmount = item.taxableValue * (igstRate / 100);
      totalIgstAmount += igstAmount;
      return {
        ...item,
        igstRate,
        igstAmount,
        cgstRate: null,
        cgstAmount: 0,
        sgstRate: null,
        sgstAmount: 0,
      };
    }
  });

  const totalTaxAmount = isIntraState ? totalCgstAmount + totalSgstAmount : totalIgstAmount;
  const amountInWords = numberToWords(Math.round(totalAmount)) + " Only";
  const taxAmountInWords = numberToWords(Math.round(totalTaxAmount)) + " Only";

  const { dc, freshNumber: dcNumber } = await withUniqueRetry(async () => {
    const freshNumber = await getNextDcNumber();
    return prisma.$transaction(async (tx) => {
      // Re-check inside the transaction so two simultaneous submits cannot both
      // pass the pre-flight check and create two forward DCs for one order.
      if (!isRto) {
        const existingDc = await tx.deliveryChallan.findFirst({
          where: { orderId },
          select: { dcNumber: true },
        });
        if (existingDc) {
          throw new Error(`A delivery challan (${existingDc.dcNumber}) already exists for this order.`);
        }
      }

      const created = await tx.deliveryChallan.create({
        data: {
          orderId,
          dcNumber: freshNumber,
          dcDate,
          warehouseId: data.warehouseId || null,
          shipToLocation: data.shipToLocation,
          billToLocation: data.billToLocation,
          modeOfPayment: data.modeOfPayment || null,
          referenceNo: data.referenceNo,
          referenceDate: data.referenceDate ? parseDateOnlyUtc(data.referenceDate) : null,
          otherReferences: data.otherReferences,
          buyersOrderNo: data.buyersOrderNo,
          buyersOrderDate: data.buyersOrderDate ? parseDateOnlyUtc(data.buyersOrderDate) : null,
          dispatchDocNo: data.dispatchDocNo,
          dispatchedThrough: data.dispatchedThrough,
          destination: data.destination,
          termsOfDelivery: data.termsOfDelivery,
          amountInWords,
          taxableValue: totalTaxableValue,
          igst: totalIgstAmount || null,
          cgst: totalCgstAmount || null,
          sgst: totalSgstAmount || null,
          totalTaxAmount,
          taxAmountInWords,
          items: {
            create: computedItems.map((item) => ({
              description: item.description,
              hsnSac: item.hsnSac,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
              taxableValue: item.taxableValue,
              igstRate: item.igstRate,
              igstAmount: item.igstAmount || 0,
              cgstRate: item.cgstRate,
              cgstAmount: item.cgstAmount || 0,
              sgstRate: item.sgstRate,
              sgstAmount: item.sgstAmount || 0,
            })),
          },
        },
        include: { items: true },
      });
      // Conditional claim: only the caller that still sees an allowed status
      // advances the order. A concurrent caller fails and rolls back its DC.
      const claimed = await tx.order.updateMany({
        where: {
          id: orderId,
          status: isRto
            ? "RTO_DC_REQUESTED"
            : { in: ["IN_PROVISIONING", "DC_REQUESTED"] },
        },
        data: { dcNumber: freshNumber, status: targetStatus },
      });
      if (claimed.count === 0) {
        throw new Error("Order status changed before the DC could be generated. Refresh and try again.");
      }
      return { dc: created, freshNumber };
    });
  });

  await syncOrderTrackingStatus(orderId, trackingStatus);

  const linkedAssets = await prisma.asset.findMany({
    where: { orderId, inventoryItemId: { not: null } },
    select: { inventoryItemId: true },
  });
  const linkedItemIds = linkedAssets.map(a => a.inventoryItemId).filter(Boolean) as string[];
  if (linkedItemIds.length > 0) {
    await prisma.inventoryItem.updateMany({
      where: { id: { in: linkedItemIds } },
      data: { dcNumber },
    });
  }

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/inventory");

  return {
    ...dc,
    taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null,
    igst: dc.igst ? Number(dc.igst) : null,
    cgst: (dc as any).cgst ? Number((dc as any).cgst) : null,
    sgst: (dc as any).sgst ? Number((dc as any).sgst) : null,
    totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null,
    items: dc.items.map(i => ({
      ...i,
      rate: Number(i.rate),
      amount: Number(i.amount),
      taxableValue: i.taxableValue ? Number(i.taxableValue) : null,
      igstRate: (i as any).igstRate ? Number((i as any).igstRate) : null,
      igstAmount: (i as any).igstAmount ? Number((i as any).igstAmount) : null,
      cgstRate: (i as any).cgstRate ? Number((i as any).cgstRate) : null,
      cgstAmount: (i as any).cgstAmount ? Number((i as any).cgstAmount) : null,
      sgstRate: (i as any).sgstRate ? Number((i as any).sgstRate) : null,
      sgstAmount: (i as any).sgstAmount ? Number((i as any).sgstAmount) : null,
    }))
  };
}
export async function getDC(dcId: string) {
  await requireAuth();
  const dc = await prisma.deliveryChallan.findUnique({
    where: { id: dcId },
    include: {
      items: true,
      warehouse: true,
      order: true,
    },
  });
  if (!dc) return null;
  return {
    ...dc,
    taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null,
    igst: dc.igst ? Number(dc.igst) : null,
    cgst: dc.cgst ? Number(dc.cgst) : null,
    sgst: dc.sgst ? Number(dc.sgst) : null,
    totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null,
    items: dc.items.map(i => ({
      ...i,
      rate: Number(i.rate),
      amount: Number(i.amount),
      taxableValue: i.taxableValue ? Number(i.taxableValue) : null,
      igstRate: i.igstRate ? Number(i.igstRate) : null,
      igstAmount: i.igstAmount ? Number(i.igstAmount) : null,
      cgstRate: i.cgstRate ? Number(i.cgstRate) : null,
      cgstAmount: i.cgstAmount ? Number(i.cgstAmount) : null,
      sgstRate: i.sgstRate ? Number(i.sgstRate) : null,
      sgstAmount: i.sgstAmount ? Number(i.sgstAmount) : null,
    })),
  };
}

export async function getDCsByOrder(orderId: string) {
  await requireAuth();
  const dcs = await prisma.deliveryChallan.findMany({
    where: { orderId },
    include: { items: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return dcs.map(dc => ({
    ...dc,
    taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null,
    igst: dc.igst ? Number(dc.igst) : null,
    cgst: dc.cgst ? Number(dc.cgst) : null,
    sgst: dc.sgst ? Number(dc.sgst) : null,
    totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null,
    items: dc.items.map(i => ({
      ...i,
      rate: Number(i.rate),
      amount: Number(i.amount),
      taxableValue: i.taxableValue ? Number(i.taxableValue) : null,
      igstRate: i.igstRate ? Number(i.igstRate) : null,
      igstAmount: i.igstAmount ? Number(i.igstAmount) : null,
      cgstRate: i.cgstRate ? Number(i.cgstRate) : null,
      cgstAmount: i.cgstAmount ? Number(i.cgstAmount) : null,
      sgstRate: i.sgstRate ? Number(i.sgstRate) : null,
      sgstAmount: i.sgstAmount ? Number(i.sgstAmount) : null,
    })),
  }));
}

// ─── Reverse Pickup DC ───

// A delivery challan line only carries a model name, while the HSN code lives
// in Product Master. Forward DCs are keyed on the inventory part number; a
// reverse pickup request only stores a serial and a model name, so its serial
// is resolved against inventory first with the model name as fallback.
async function lookupProductHsn(partNo?: string | null, modelName?: string | null): Promise<string | null> {
  if (partNo) {
    const byPartNo = await prisma.productMaster.findFirst({
      where: { partNo: { equals: partNo, mode: "insensitive" } },
      select: { hsnCode: true },
    });
    if (byPartNo?.hsnCode) return byPartNo.hsnCode;
  }
  if (modelName) {
    const byModel = await prisma.productMaster.findFirst({
      where: { model: { equals: modelName, mode: "insensitive" } },
      select: { hsnCode: true },
    });
    if (byModel?.hsnCode) return byModel.hsnCode;
  }
  return null;
}

async function resolveProductHsn(serialNumber: string | null, model: string | null): Promise<string | null> {
  const serial = serialNumber?.trim();
  if (serial) {
    const item = await prisma.inventoryItem.findUnique({
      where: { serialNumber: serial },
      select: { partNo: true, model: true },
    });
    const hsn = await lookupProductHsn(item?.partNo, item?.model);
    if (hsn) return hsn;
  }

  return lookupProductHsn(null, model?.trim());
}

// Product Master is the source of truth for the GST rate. The DC preview needs
// it per line so it can show the same CGST/SGST or IGST split the server will
// store, instead of guessing a flat rate.
async function lookupProductGstRate(partNo?: string | null, modelName?: string | null, hsnCode?: string | null): Promise<number | null> {
  if (partNo) {
    const pm = await prisma.productMaster.findFirst({
      where: { partNo: { equals: partNo, mode: "insensitive" } },
      select: { gstRate: true },
    });
    if (pm?.gstRate != null) return Number(pm.gstRate);
  }
  if (modelName) {
    const pm = await prisma.productMaster.findFirst({
      where: { model: { equals: modelName, mode: "insensitive" } },
      select: { gstRate: true },
    });
    if (pm?.gstRate != null) return Number(pm.gstRate);
  }
  if (hsnCode) {
    const pm = await prisma.productMaster.findFirst({
      where: { hsnCode: { equals: hsnCode, mode: "insensitive" } },
      select: { gstRate: true },
    });
    if (pm?.gstRate != null) return Number(pm.gstRate);
  }
  return null;
}

export async function getReversePickupForDc(rpId: string) {
  await requireAuth();
  const rp = await prisma.reversePickupRequest.findUnique({
    where: { id: rpId },
  });
  if (!rp) return null;

  const fullAddress = [rp.pickupAddress, rp.city, rp.state, rp.pinCode].filter(Boolean).join(", ");
  const hsnCode = await resolveProductHsn(rp.serialNumber, rp.model);
  const gstRate = await lookupProductGstRate(null, rp.model, hsnCode);

  return {
    id: rp.id,
    clientName: rp.employeeName,
    totalQuantity: 1,
    deliveryLocation: fullAddress || rp.pickupAddress,
    fullAddress: fullAddress || rp.pickupAddress,
    warehouseLocation: rp.warehouseLocation || "",
    docketNumber: "",
    // Reverse pickup is a return leg, so the DC leaves through the same pickup
    // partner that collected the asset rather than a forward courier.
    partnerName: rp.partnerName || "",
    items: [{ description: rp.model || "Laptop", hsnSac: hsnCode ?? "", quantity: 1, rate: 0, gstRate }],
  };
}

export async function generateReversePickupDc(rpId: string, data: DcFormData) {
  const user = await getSession();
  requirePermission(user, "finance", "canCreate");

  const rp = await prisma.reversePickupRequest.findUnique({ where: { id: rpId } });
  if (!rp) throw new Error("Reverse pickup request not found");

  // A reverse DC carries a single return line; reject anything that would store
  // a broken quantity or rate.
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("At least one item is required.");
  }
  for (const [index, item] of data.items.entries()) {
    if (!item.description?.trim()) {
      throw new Error(`Item ${index + 1}: description is required.`);
    }
    if (!Number.isFinite(item.quantity) || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error(`Item ${index + 1}: quantity must be a whole number of at least 1.`);
    }
    if (!Number.isFinite(item.rate) || item.rate < 0) {
      throw new Error(`Item ${index + 1}: rate must be a non-negative number.`);
    }
  }

  const dcDate = todayDateOnlyUtc();
  const resolvedHsn = await resolveProductHsn(rp.serialNumber, rp.model);

  const isIntraState = isIntraStateSupply(
    rp.warehouseLocation,
    rp.pickupAddress || `${rp.pickupAddress}, ${rp.city}, ${rp.state}, ${rp.pinCode}`
  );

  const items = await Promise.all(
    data.items.map(async (item) => {
      const amount = item.quantity * item.rate;
      const taxableValue = amount;
      const key = (item.description || "").trim().toLowerCase();
      const hsnSac = item.hsnSac || resolvedHsn || "";
      let gstRate = 18;
      const pm = await prisma.productMaster.findFirst({
        where: hsnSac ? { hsnCode: { equals: hsnSac, mode: "insensitive" } } : { model: { equals: key, mode: "insensitive" } },
        select: { gstRate: true },
      });
      if (pm?.gstRate != null) gstRate = Number(pm.gstRate);
      return { ...item, hsnSac, amount, taxableValue, gstRate };
    })
  );

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);
  const totalTaxableValue = items.reduce((sum, i) => sum + i.taxableValue, 0);

  let totalIgstAmount = 0;
  let totalCgstAmount = 0;
  let totalSgstAmount = 0;
  const computedItems = items.map((item) => {
    const gstRate = item.gstRate || 18;
    if (isIntraState) {
      const cgstRate = gstRate / 2;
      const sgstRate = gstRate / 2;
      const cgstAmount = item.taxableValue * (cgstRate / 100);
      const sgstAmount = item.taxableValue * (sgstRate / 100);
      totalCgstAmount += cgstAmount;
      totalSgstAmount += sgstAmount;
      return {
        ...item,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate: null,
        igstAmount: 0,
      };
    } else {
      const igstRate = gstRate;
      const igstAmount = item.taxableValue * (igstRate / 100);
      totalIgstAmount += igstAmount;
      return {
        ...item,
        igstRate,
        igstAmount,
        cgstRate: null,
        cgstAmount: 0,
        sgstRate: null,
        sgstAmount: 0,
      };
    }
  });

  const totalTaxAmount = isIntraState ? totalCgstAmount + totalSgstAmount : totalIgstAmount;
  const amountInWords = numberToWords(Math.round(totalAmount)) + " Only";
  const taxAmountInWords = numberToWords(Math.round(totalTaxAmount)) + " Only";

  const { dc, freshNumber: dcNumber } = await withUniqueRetry(async () => {
    const freshNumber = await getNextDcNumber();
    return prisma.$transaction(async (tx) => {
      const existingDc = await tx.deliveryChallan.findFirst({
        where: { reversePickupRequestId: rpId },
        select: { dcNumber: true },
      });
      if (existingDc) {
        throw new Error(`A delivery challan (${existingDc.dcNumber}) already exists for this reverse pickup.`);
      }

      const created = await tx.deliveryChallan.create({
        data: {
          reversePickupRequestId: rpId,
          dcNumber: freshNumber,
          dcDate,
          warehouseId: data.warehouseId || null,
          shipToLocation: data.shipToLocation,
          billToLocation: data.billToLocation,
          modeOfPayment: null,
          referenceNo: data.referenceNo,
          referenceDate: data.referenceDate ? parseDateOnlyUtc(data.referenceDate) : null,
          otherReferences: data.otherReferences,
          buyersOrderNo: data.buyersOrderNo,
          buyersOrderDate: data.buyersOrderDate ? parseDateOnlyUtc(data.buyersOrderDate) : null,
          dispatchDocNo: data.dispatchDocNo,
          dispatchedThrough: data.dispatchedThrough || rp.partnerName,
          destination: data.destination,
          termsOfDelivery: data.termsOfDelivery,
          amountInWords,
          taxableValue: totalTaxableValue,
          igst: totalIgstAmount || null,
          cgst: totalCgstAmount || null,
          sgst: totalSgstAmount || null,
          totalTaxAmount,
          taxAmountInWords,
          items: {
            create: computedItems.map((item) => ({
              description: item.description,
              hsnSac: item.hsnSac,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
              taxableValue: item.taxableValue,
              igstRate: item.igstRate,
              igstAmount: item.igstAmount || 0,
              cgstRate: item.cgstRate,
              cgstAmount: item.cgstAmount || 0,
              sgstRate: item.sgstRate,
              sgstAmount: item.sgstAmount || 0,
            })),
          },
        },
        include: { items: true },
      });
      const claimed = await tx.reversePickupRequest.updateMany({
        where: { id: rpId, dcNo: null },
        data: { dcNo: freshNumber, status: "DC_GENERATED" },
      });
      if (claimed.count === 0) {
        throw new Error("A DC was already generated for this reverse pickup, or its status changed.");
      }
      return { dc: created, freshNumber };
    });
  });

  if (rp.inventoryItemId) {
    await prisma.inventoryItem.update({
      where: { id: rp.inventoryItemId },
      data: { dcNumber },
    });
  }

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/reverse-pickup");
  revalidatePath("/dashboard/inventory");

  return {
    ...dc,
    taxableValue: dc.taxableValue ? Number(dc.taxableValue) : null,
    igst: dc.igst ? Number(dc.igst) : null,
    cgst: (dc as any).cgst ? Number((dc as any).cgst) : null,
    sgst: (dc as any).sgst ? Number((dc as any).sgst) : null,
    totalTaxAmount: dc.totalTaxAmount ? Number(dc.totalTaxAmount) : null,
    items: dc.items.map(i => ({
      ...i,
      rate: Number(i.rate),
      amount: Number(i.amount),
      taxableValue: i.taxableValue ? Number(i.taxableValue) : null,
      igstRate: (i as any).igstRate ? Number((i as any).igstRate) : null,
      igstAmount: (i as any).igstAmount ? Number((i as any).igstAmount) : null,
      cgstRate: (i as any).cgstRate ? Number((i as any).cgstRate) : null,
      cgstAmount: (i as any).cgstAmount ? Number((i as any).cgstAmount) : null,
      sgstRate: (i as any).sgstRate ? Number((i as any).sgstRate) : null,
      sgstAmount: (i as any).sgstAmount ? Number((i as any).sgstAmount) : null,
    }))
  };
}


export async function updateDcDocket(docketId: string, docketNumber: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canEdit");
  const value = docketNumber.trim();
  if (!value) throw new Error("Docket number is required.");

  const existing = await prisma.docket.findUnique({
    where: { id: docketId },
    select: { id: true, orderId: true, order: { select: { status: true } } },
  });
  if (!existing) throw new Error("Docket not found.");

  // The docket number is unique across orders; surface a clear error instead of
  // letting the unique constraint bubble up as a raw database failure.
  const duplicate = await prisma.docket.findFirst({
    where: { docketNumber: value, id: { not: docketId } },
    select: { id: true },
  });
  if (duplicate) throw new Error("Docket number already exists.");

  // A docket can only be corrected while its order is still in the warehouse.
  // Editing one after dispatch would rewrite the record for a parcel that has
  // already left.
  if (!DOCKET_EDITABLE_STATUSES.includes(existing.order.status)) {
    throw new Error(
      `A docket can only be edited while the order is in the warehouse; this order is "${existing.order.status}".`
    );
  }

  const docket = await prisma.docket.update({
    where: { id: docketId },
    data: { docketNumber: value },
  });

  if (docket.orderId) {
    const linkedAssets = await prisma.asset.findMany({
      where: { orderId: docket.orderId, inventoryItemId: { not: null } },
      select: { inventoryItemId: true },
    });
    const linkedItemIds = linkedAssets.map(a => a.inventoryItemId).filter(Boolean) as string[];
    if (linkedItemIds.length > 0) {
      await prisma.inventoryItem.updateMany({
        where: { id: { in: linkedItemIds } },
        data: { docketNumber: value },
      });
    }
  }

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/logistics");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");

  return { ok: true };
}

// ─── Dispatched Through Dropdown ───

export async function getDispatchedThroughOptions() {
  await requireAuth();
  const options = await prisma.dropdownOption.findMany({
    where: { category: "dispatchedThrough" },
    orderBy: { value: "asc" },
  });
  return options.map(o => ({ id: o.id, value: o.value }));
}

export async function addDispatchedThroughOption(value: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canCreate");
  await prisma.dropdownOption.upsert({
    where: { category_value: { category: "dispatchedThrough", value } },
    update: {},
    create: { category: "dispatchedThrough", value },
  });
}

export async function deleteDispatchedThroughOption(id: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canDelete");
  await prisma.dropdownOption.delete({ where: { id } });
}

// ─── Bill To Location Dropdown ───

export async function getBillToLocationOptions() {
  await requireAuth();
  const options = await prisma.dropdownOption.findMany({
    where: { category: "billToLocation" },
    orderBy: { value: "asc" },
  });
  return options.map(o => ({ id: o.id, value: o.value }));
}

export async function addBillToLocationOption(value: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canCreate");
  await prisma.dropdownOption.upsert({
    where: { category_value: { category: "billToLocation", value } },
    update: {},
    create: { category: "billToLocation", value },
  });
}

export async function deleteBillToLocationOption(id: string) {
  const user = await getSession();
  requirePermission(user, "finance", "canDelete");
  await prisma.dropdownOption.delete({ where: { id } });
}

export async function getOrderForDc(orderId: string) {
  await requireAuth();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      assets: {
        include: { inventoryItem: true },
      },
      dockets: {
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      },
    },
  });
  if (!order) return null;

  const productItems = await Promise.all(
    order.assets
      .filter(a => a.inventoryItem)
      .map(async a => {
        const hsnSac = (await lookupProductHsn(a.inventoryItem!.partNo, a.inventoryItem!.model)) ?? "";
        const gstRate = await lookupProductGstRate(a.inventoryItem!.partNo, a.inventoryItem!.model, hsnSac);
        return {
          description: a.inventoryItem!.model || "",
          hsnSac,
          quantity: 1,
          rate: 0,
          gstRate,
        };
      })
  );

  const warehouse = order.warehouseLocation || "";

  // Build full user address from inventory item
  const inv = order.assets.find(a => a.inventoryItem)?.inventoryItem;
  const fullAddress = inv
    ? [inv.shippingAddress, inv.city, inv.state, inv.pinCode].filter(Boolean).join(", ")
    : order.deliveryLocation;

  const docketNumber = order.dockets[0]?.docketNumber || "";
  const dispatchCourier = order.dockets[0]?.courierName || "";

  return {
    id: order.id,
    clientName: order.clientName,
    totalQuantity: order.totalQuantity,
    deliveryLocation: order.deliveryLocation,
    fullAddress,
    warehouseLocation: warehouse,
    docketNumber,
    dispatchCourier,
    items: productItems.length > 0 ? productItems : [{ description: "", hsnSac: "", quantity: 1, rate: 0, gstRate: null }],
  };
}
