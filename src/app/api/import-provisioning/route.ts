import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { toDenseRow, toDenseRows } from "@/lib/sheet-cells";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

const baseMapping: Record<string, string> = {
  "Client Name": "clientName",
  "Client": "clientName",
  "Delivery Location": "deliveryLocation",
  "Location": "deliveryLocation",
  "Location City": "deliveryLocation",
  "Warehouse Location": "warehouseLocation",
  "Warehouse": "warehouseLocation",
  "Current Warehouse Location": "warehouseLocation",
  "Provisioning Location": "provisioningLocation",
  "Provisioning Loc": "provisioningLocation",
  "Engineer Name": "engineerName",
  "Engineer": "engineerName",
  "Serial Number": "serialNumber",
  "Serial No": "serialNumber",
  "Serial No.": "serialNumber",
  "Serial": "serialNumber",
  "S No": "serialNumber",
  "SerialNumber": "serialNumber",
  "Serial#": "serialNumber",
  "Sr No": "serialNumber",
  "SrNo": "serialNumber",
  "Sr No.": "serialNumber",
  "SN": "serialNumber",
  "Asset Tag": "serialNumber",
  "Asset Tag No": "serialNumber",
  "Total Quantity": "totalQuantity",
  "Quantity": "totalQuantity",
  "Qty": "totalQuantity",
  // inventory enrichment columns (auto-create inventory if missing)
  "Model": "model",
  "Laptop Model": "model",
  "Part No": "partNo",
  "Part Number": "partNo",
  "PartNo": "partNo",
  "Specs": "specs",
  "Specifications": "specs",
  "Laptop Make": "laptopMake",
  "Make": "laptopMake",
  "Category": "category",
  "Product Category": "category",
  "Brand": "brand",
  "Invoice Product Description": "invoiceProductDescription",
  "Description": "description",
  "Warranty Period": "warrantyPeriod",
  "Warranty End Period": "warrantyEndPeriod",
  "Tier": "tier",
  "TAT": "tat",
  "Delivery TAT Days": "deliveryTatDays",
  "Zone": "zone",
  "ODA Location": "odaLocation",
  "SLA State": "slaState",
  "Partner": "partner",
  "Entity": "entity",
  "SR": "sr",
};

const aliases: Record<string, string> = {
  "client name": "clientName",
  "client": "clientName",
  "delivery location": "deliveryLocation",
  "location": "deliveryLocation",
  "delivery loc": "deliveryLocation",
  "location city": "deliveryLocation",
  "warehouse location": "warehouseLocation",
  "warehouse": "warehouseLocation",
  "wh": "warehouseLocation",
  "current warehouse location": "warehouseLocation",
  "provisioning location": "provisioningLocation",
  "provisioning loc": "provisioningLocation",
  "prov loc": "provisioningLocation",
  "engineer name": "engineerName",
  "engineer": "engineerName",
  "serial number": "serialNumber",
  "serial no": "serialNumber",
  "serial": "serialNumber",
  "s no": "serialNumber",
  "sn": "serialNumber",
  "serialnumber": "serialNumber",
  "serial#": "serialNumber",
  "sr no": "serialNumber",
  "srno": "serialNumber",
  "sr no.": "serialNumber",
  "asset tag": "serialNumber",
  "asset tag no": "serialNumber",
  "total quantity": "totalQuantity",
  "quantity": "totalQuantity",
  "qty": "totalQuantity",
  // inventory enrichment aliases
  "model": "model",
  "laptop model": "model",
  "part no": "partNo",
  "part number": "partNo",
  "partno": "partNo",
  "specs": "specs",
  "specifications": "specs",
  "laptop make": "laptopMake",
  "make": "laptopMake",
  "category": "category",
  "product category": "category",
  "brand": "brand",
  "invoice product description": "invoiceProductDescription",
  "description": "description",
  "warranty period": "warrantyPeriod",
  "warranty end period": "warrantyEndPeriod",
  "tier": "tier",
  "tat": "tat",
  "delivery tat days": "deliveryTatDays",
  "zone": "zone",
  "oda location": "odaLocation",
  "sla state": "slaState",
  "partner": "partner",
  "entity": "entity",
  "sr": "sr",
};

const normLookup: Record<string, string> = {};
for (const [raw, col] of Object.entries(baseMapping)) {
  normLookup[normalize(raw)] = col;
}
for (const [alias, col] of Object.entries(aliases)) {
  normLookup[normalize(alias)] = col;
}

function resolveColumn(header: string): string | undefined {
  const n = normalize(header);
  if (!n) return undefined;
  return normLookup[n];
}

async function parseFile(file: File): Promise<{ headers: string[]; records: string[][] }> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    const text = await file.text();
    const parsed = parse(text, { skip_empty_lines: true }) as string[][];
    if (parsed.length < 2) {
      throw new Error("File must have a header row and at least one data row.");
    }
    return {
      headers: toDenseRow(parsed[0]),
      records: toDenseRows(parsed.slice(1)),
    };
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("Excel file has no sheets.");

    const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    if (json.length < 2) {
      throw new Error("File must have a header row and at least one data row.");
    }

    const headers = toDenseRow(json[0]);
    const records = toDenseRows(json.slice(1));
    return { headers, records };
  }

  throw new Error("Unsupported file format. Please upload a .csv or .xlsx file.");
}

interface RowData {
  clientName: string;
  deliveryLocation: string;
  warehouseLocation: string;
  provisioningLocation: string;
  engineerName: string;
  serialNumber: string;
  totalQuantity: string;
  // inventory enrichment fields
  model: string;
  partNo: string;
  specs: string;
  laptopMake: string;
  category: string;
  brand: string;
  invoiceProductDescription: string;
  description: string;
  warrantyPeriod: string;
  warrantyEndPeriod: string;
  tier: string;
  tat: string;
  deliveryTatDays: string;
  zone: string;
  odaLocation: string;
  slaState: string;
  partner: string;
  entity: string;
  sr: string;
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "PROVISIONING")) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json(
      { success: false, error: "No file provided." },
      { status: 400 }
    );
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return NextResponse.json(
      { success: false, error: "Only .csv and .xlsx files are supported." },
      { status: 400 }
    );
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json(
      { success: false, error: "File exceeds the 20 MB limit." },
      { status: 413 }
    );
  }

  let headers: string[];
  let records: string[][];
  try {
    ({ headers, records } = await parseFile(file));
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to parse file." },
      { status: 400 }
    );
  }

  const resolvedMap = new Map<number, string>();
  const unknownHeaders: string[] = [];

  for (let i = 0; i < headers.length; i++) {
    const header = (headers[i] ?? "").trim();
    const column = resolveColumn(header);
    if (column) {
      resolvedMap.set(i, column);
    } else {
      unknownHeaders.push(header);
    }
  }

  const errors: string[] = [];
  const parsedRows: (RowData & { rowNum: number })[] = [];

  for (let r = 0; r < records.length; r++) {
    const row = records[r];
    if (row.length === 0 || row.every(c => (c ?? "").trim() === "")) continue;

    const data: RowData = {
      clientName: "",
      deliveryLocation: "",
      warehouseLocation: "",
      provisioningLocation: "",
      engineerName: "",
      serialNumber: "",
      totalQuantity: "",
      model: "",
      partNo: "",
      specs: "",
      laptopMake: "",
      category: "",
      brand: "",
      invoiceProductDescription: "",
      description: "",
      warrantyPeriod: "",
      warrantyEndPeriod: "",
      tier: "",
      tat: "",
      deliveryTatDays: "",
      zone: "",
      odaLocation: "",
      slaState: "",
      partner: "",
      entity: "",
      sr: "",
    };

    for (let i = 0; i < headers.length; i++) {
      const col = resolvedMap.get(i);
      if (col && col in data) {
        (data as any)[col] = row[i]?.trim() ?? "";
      }
    }

    if (!data.serialNumber) {
      errors.push(`Row ${r + 2}: Serial number is empty — skipped`);
      continue;
    }
    if (!data.clientName) {
      data.clientName = "PWC";
    }
    if (!data.deliveryLocation) {
      errors.push(`Row ${r + 2}: Delivery location is empty for "${data.serialNumber}" — skipped`);
      continue;
    }

    parsedRows.push({ ...data, rowNum: r + 2 });
  }

  const allSerials = [...new Set(parsedRows.map(r => r.serialNumber))];

  const inventoryMap = new Map<string, { id: string; status: string }>();
  const CHUNK = 500;
  for (let c = 0; c < allSerials.length; c += CHUNK) {
    const chunk = allSerials.slice(c, c + CHUNK);
    const items = await prisma.inventoryItem.findMany({
      where: { serialNumber: { in: chunk } },
      select: { serialNumber: true, id: true, status: true },
    });
    for (const item of items) {
      inventoryMap.set(item.serialNumber, { id: item.id, status: item.status });
    }
  }

  // Create missing inventory items from provisioning data
  const missingSerials = allSerials.filter(sn => !inventoryMap.has(sn));
  if (missingSerials.length > 0) {
    // Bulk create missing inventory items
    const createData = missingSerials.map(sn => {
      const row = parsedRows.find(r => r.serialNumber === sn)!;
      const model = row.model || row.laptopMake || "Unknown";
      const data: Record<string, any> = {
        serialNumber: sn,
        model,
        status: "AVAILABLE",
      };
      if (row.partNo) data.partNo = row.partNo;
      if (row.specs) data.specs = row.specs;
      if (row.laptopMake) data.laptopMake = row.laptopMake;
      if (row.category) data.category = row.category;
      if (row.brand) data.brand = row.brand;
      if (row.invoiceProductDescription) data.invoiceProductDescription = row.invoiceProductDescription;
      if (row.description) data.description = row.description;
      if (row.warrantyPeriod) data.warrantyPeriod = row.warrantyPeriod;
      if (row.warrantyEndPeriod) data.warrantyEndPeriod = row.warrantyEndPeriod;
      if (row.tier) data.tier = row.tier;
      if (row.tat) data.tat = row.tat;
      if (row.deliveryTatDays) data.deliveryTatDays = parseInt(row.deliveryTatDays) || null;
      if (row.zone) data.zone = row.zone;
      if (row.odaLocation) data.odaLocation = row.odaLocation;
      if (row.slaState) data.slaState = row.slaState;
      if (row.partner) data.partner = row.partner;
      if (row.entity) data.entity = row.entity;
      if (row.sr) data.sr = parseInt(row.sr) || null;
      if (row.warehouseLocation) data.invoicingWarehouse = row.warehouseLocation;
      if (row.engineerName) data.engineerName = row.engineerName;
      if (row.provisioningLocation) data.provisioningLocation = row.provisioningLocation;
      if (row.clientName) data.clientName = row.clientName;
      if (row.deliveryLocation) data.deliveredLocation = row.deliveryLocation;
      return data;
    }) as any[];

    try {
      const createdItems = await prisma.inventoryItem.createMany({ data: createData, skipDuplicates: true });
      // Fetch the newly created items to add to inventoryMap
      const newItems = await prisma.inventoryItem.findMany({
        where: { serialNumber: { in: missingSerials } },
        select: { serialNumber: true, id: true, status: true },
      });
      for (const item of newItems) {
        inventoryMap.set(item.serialNumber, { id: item.id, status: item.status });
      }
      console.log(`[Provisioning] Auto-created ${createdItems.count} inventory items`);
    } catch (err: any) {
      errors.push(`Failed to auto-create inventory items: ${err?.message ?? "Unknown error"}`);
    }
  }

  interface OrderGroup {
    clientName: string;
    deliveryLocation: string;
    warehouseLocation: string;
    provisioningLocation: string;
    engineerName: string;
    serialNumbers: { serialNumber: string; inventoryItemId: string; rowNum: number }[];
  }

  const orderMap = new Map<string, OrderGroup>();

  for (const row of parsedRows) {
    const inv = inventoryMap.get(row.serialNumber);
    if (!inv) {
      errors.push(`Row ${row.rowNum}: Serial number "${row.serialNumber}" not found in inventory — skipped`);
      continue;
    }
    if (inv.status !== "AVAILABLE" && inv.status !== "ALLOCATED") {
      errors.push(`Row ${row.rowNum}: "${row.serialNumber}" has status "${inv.status}" (must be AVAILABLE or ALLOCATED) — skipped`);
      continue;
    }

    const orderKey = `${row.clientName}||${row.deliveryLocation}`;
    if (!orderMap.has(orderKey)) {
      orderMap.set(orderKey, {
        clientName: row.clientName,
        deliveryLocation: row.deliveryLocation,
        warehouseLocation: row.warehouseLocation,
        provisioningLocation: row.provisioningLocation,
        engineerName: row.engineerName,
        serialNumbers: [],
      });
    }
    orderMap.get(orderKey)!.serialNumbers.push({
      serialNumber: row.serialNumber,
      inventoryItemId: inv.id,
      rowNum: row.rowNum,
    });
  }

  let ordersCreated = 0;
  let assetsCreated = 0;

  for (const group of orderMap.values()) {
    if (group.serialNumbers.length === 0) continue;

    const order = await prisma.order.create({
      data: {
        clientName: group.clientName,
        intermediary: "HP",
        totalQuantity: group.serialNumbers.length,
        deliveryLocation: group.deliveryLocation,
        status: "IN_PROVISIONING",
        warehouseLocation: group.warehouseLocation || null,
        provisioningLocation: group.provisioningLocation || null,
        engineerName: group.engineerName || null,
      },
    });

    const assetData = group.serialNumbers.map(sn => ({
      orderId: order.id,
      inventoryItemId: sn.inventoryItemId,
      status: "allocated" as const,
    }));

    await prisma.asset.createMany({ data: assetData });

    const inventoryIds = group.serialNumbers.map(sn => sn.inventoryItemId);
    await prisma.inventoryItem.updateMany({
      where: { id: { in: inventoryIds } },
      data: { status: "ALLOCATED" },
    });

    if (group.warehouseLocation) {
      await prisma.inventoryItem.updateMany({
        where: { id: { in: inventoryIds } },
        data: { invoicingWarehouse: group.warehouseLocation },
      });
    }

    ordersCreated++;
    assetsCreated += assetData.length;
  }

  revalidatePath("/dashboard/provisioning");
  revalidatePath("/dashboard/warehouse");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");

  const uniqueUnknown = [...new Set(unknownHeaders)];
  const warning = uniqueUnknown.length > 0
    ? `Unrecognized columns ignored: ${uniqueUnknown.join(", ")}.`
    : "";

  return NextResponse.json({
    success: true,
    ordersCreated,
    assetsCreated,
    errors: errors.length > 0 ? errors : null,
    warning: warning || null,
  });
}
