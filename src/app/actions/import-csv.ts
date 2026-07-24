"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parse } from "csv-parse/sync";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-/()]+/g, " ").replace(/\s+/g, " ").trim();
}

const baseMapping: Record<string, string> = {
  "Serial Number": "serialNumber",
  "Model": "model",
  "Part No": "partNo",
  "Specs": "specs",
  "Status": "status",
  "Partner": "partner",
  "Sr #": "sr",
  "Entity": "entity",
  "User Base Location": "userBaseLocation",
  "Image Type": "imageType",
  "Purpose": "purpose",
  "Request Date": "requestDate",
  "Count": "count",
  "Employee Name": "employeeName",
  "Email ID": "emailId",
  "Shipping Address": "shippingAddress",
  "Land Mark": "landMark",
  "City": "city",
  "State": "state",
  "Pin Code": "pinCode",
  "Mobile Number": "mobileNumber",
  "PwC Remarks": "pwcRemarks",
  "Laptop Make": "laptopMake",
  "Laptop Model": "laptopModel",
  "Invoice Product Description": "invoiceProductDescription",
  "Description": "description",
  "Email Received Hour": "emailReceivedHour",
  "Cut Off Status": "cutOffStatus",
  "SLA Start Date": "slaStartDate",
  "State (SLA)": "slaState",
  "Zone": "zone",
  "Tier": "tier",
  "ODA Location": "odaLocation",
  "TAT": "tat",
  "Delivery TAT (Days)": "deliveryTatDays",
  "Actual Delivery Date": "actualDeliveryDate",
  "SLA Missed/Met": "slaStatus",
  "Laptop Acceptance Date": "laptopAcceptanceDate",
  "Invoiced Quantity": "invoicedQuantity",
  "Warranty Period": "warrantyPeriod",
  "Warranty End Period": "warrantyEndPeriod",
  "Customer Instruction Doc": "customerInstructionDoc",
  "Adaptor Added": "adaptorAdded",
  "Accessory Headset/Mouse": "accessoryHeadsetMouse",
  "Sticker Colour": "stickerColour",
  "Delivery Date": "deliveryDate",
  "DC": "dc",
  "Vendor": "vendor",
  "Delivered Location": "deliveredLocation",
  "Docket Number": "docketNumber",
  "Tracking Status": "trackingStatus",
  "Tracking Sub Status": "trackingSubStatus",
  "Pickup Date": "pickupDate",
  "Alternate Phone Number": "alternatePhoneNumber",
  "Process Status": "processStatus",
  "Machine WS1 Status": "machineWs1Status",
  "Serial No in WS1": "serialNoInWs1",
  "Date of WS1 Update": "dateOfWs1Update",
  "Services Start Date": "servicesStartDate",
  "Invoicing Warehouse": "invoicingWarehouse",
  "Box Serial No": "boxSerialNo",
  "Check": "checkField",
  "Remark": "remark",
  "DC Number": "dcNumber",
  "Date": "date",
  "Status_1": "csvStatus",
};

const aliases: Record<string, string> = {
  "name of the employee": "employeeName",
  "serial no in ws1": "serialNoInWs1",
  "date of ws1 update": "dateOfWs1Update",
  "invoice product discription": "invoiceProductDescription",
  "email recieved hour": "emailReceivedHour",
  "delivery tat in days": "deliveryTatDays",
  "actual delivery pod date": "actualDeliveryDate",
  "customer instruction doc": "customerInstructionDoc",
  "accessory headset mouse yes no": "accessoryHeadsetMouse",
  "pick up date": "pickupDate",
};

const normLookup: Record<string, string> = {};
for (const [raw, col] of Object.entries(baseMapping)) {
  normLookup[normalize(raw)] = col;
}
for (const [alias, col] of Object.entries(aliases)) {
  normLookup[alias] = col;
}

function resolveColumn(header: string): string | undefined {
  return normLookup[normalize(header)];
}

const dateFields = new Set([
  "requestDate",
  "slaStartDate",
  "actualDeliveryDate",
  "laptopAcceptanceDate",
  "warrantyEndPeriod",
  "deliveryDate",
  "pickupDate",
  "dateOfWs1Update",
  "servicesStartDate",
  "date",
]);

const intFields = new Set([
  "sr",
  "count",
  "deliveryTatDays",
  "invoicedQuantity",
]);

const validStatuses = new Set([
  "NEW", "AVAILABLE", "ALLOCATED", "DEFECTIVE", "RETIRED",
]);

function parseValue(value: string, field: string): unknown {
  if (value === "" || value === undefined || value === null) return null;
  if (dateFields.has(field)) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (intFields.has(field)) {
    const n = parseInt(value, 10);
    return isNaN(n) ? null : n;
  }
  if (field === "status") {
    const upper = value.toUpperCase();
    return validStatuses.has(upper) ? upper : null;
  }
  return value;
}

function buildPrismaData(
  headers: string[],
  row: string[],
  unknownHeaders: string[]
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].trim();
    const column = resolveColumn(header);
    if (!column) {
      unknownHeaders.push(header);
      continue;
    }
    data[column] = parseValue(row[i]?.trim() ?? "", column);
  }
  return data;
}

export async function importInventoryCSV(formData: FormData) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized. Admin access required." };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { success: false, error: "No file provided." };
  }

  if (!file.name.endsWith(".csv")) {
    return { success: false, error: "Only .csv files are supported." };
  }

  const text = await file.text();
  let records: string[][];
  try {
    records = parse(text, { skip_empty_lines: true }) as string[][];
  } catch {
    return { success: false, error: "Failed to parse CSV file. Check the file format." };
  }

  if (records.length < 2) {
    return { success: false, error: "CSV must have a header row and at least one data row." };
  }

  const headers = records[0];
  const unknownHeaders: string[] = [];
  const errors: string[] = [];

  const rows: { data: Record<string, unknown>; rowNum: number }[] = [];
  for (let r = 1; r < records.length; r++) {
    const row = records[r];
    if (row.length === 0 || row.every(c => c.trim() === "")) continue;

    const data = buildPrismaData(headers, row, unknownHeaders);

    if (!data.serialNumber || String(data.serialNumber).trim() === "") {
      errors.push(`Row ${r + 1}: No serial number found, skipped`);
      continue;
    }

    if (!data.model && data.laptopModel) {
      data.model = data.laptopModel;
    }

    rows.push({ data, rowNum: r + 1 });
  }

  // ── PRODUCT MASTER ENRICHMENT ──
  // Always override with ProductMaster values when partNo matches
  const partNos = [...new Set(
    rows.map(r => String(r.data.partNo ?? "").trim()).filter(Boolean)
  )];

  if (partNos.length > 0) {
    const products = await prisma.productMaster.findMany({
      where: { partNo: { in: partNos } },
      select: { partNo: true, make: true, model: true, description: true, warranty: true },
    });
    const productMap = new Map(products.filter(p => p.partNo).map(p => [p.partNo!, p]));

    for (const row of rows) {
      const pn = String(row.data.partNo ?? "").trim();
      if (!pn) continue;
      const product = productMap.get(pn);
      if (!product) continue;

      row.data.model = product.model;
      row.data.laptopMake = product.make;
      row.data.invoiceProductDescription = product.description;
      row.data.description = product.description;
      row.data.warrantyPeriod = product.warranty;
    }
  }

  const assignmentFields = [
    "employeeName", "emailId", "mobileNumber", "alternatePhoneNumber",
    "shippingAddress", "landMark", "city", "state", "pinCode",
    "purpose", "requestDate", "userBaseLocation", "imageType", "count",
    "pwcRemarks", "trackingStatus", "trackingSubStatus", "dcNumber",
    "docketNumber", "deliveryDate",
  ];

  const allSerials = [...new Set(
    rows.map(r => String(r.data.serialNumber ?? "").trim()).filter(Boolean)
  )];

  const existingItems = await prisma.inventoryItem.findMany({
    where: { serialNumber: { in: allSerials } },
    select: { id: true, serialNumber: true },
  });

  const existingMap = new Map(existingItems.map(item => [item.serialNumber, item.id]));
  let mapped = 0;

  for (const item of rows) {
    const sn = String(item.data.serialNumber ?? "").trim();
    let itemId = existingMap.get(sn);

    if (!itemId) {
      try {
        const cleanData = Object.fromEntries(
          Object.entries(item.data).filter(([_, v]) => v !== null && v !== undefined)
        );
        if (!cleanData.serialNumber) cleanData.serialNumber = sn;
        const hasEmployee = cleanData.employeeName && String(cleanData.employeeName).trim() !== "";
        const hasEntity = cleanData.entity && String(cleanData.entity).trim() !== "";
        if (!cleanData.status) {
          cleanData.status = hasEmployee ? "ALLOCATED" : "NEW";
        } else if (cleanData.status === "AVAILABLE" && !hasEntity) {
          cleanData.status = "NEW";
        }
        const created = await prisma.inventoryItem.create({ data: cleanData as any });
        itemId = created.id;
      } catch (err: any) {
        errors.push(`Row ${item.rowNum}: Failed to create item "${sn}" - ${err?.message ?? "Unknown error"}`);
        continue;
      }
    }

    try {
      const assignmentData: Record<string, unknown> = { inventoryItemId: itemId };
      for (const f of assignmentFields) {
        assignmentData[f] = (item.data as any)[f] ?? null;
      }
      assignmentData.assignedAt = new Date();
      await prisma.assignmentRecord.create({ data: assignmentData as any });
      mapped++;
    } catch (err: any) {
      errors.push(`Row ${item.rowNum}: Failed to map assignment for "${sn}" - ${err?.message ?? "Unknown error"}`);
    }
  }

  revalidatePath("/dashboard/inventory");

  const uniqueUnknown = [...new Set(unknownHeaders)];
  let warning = "";
  if (uniqueUnknown.length > 0) {
    warning = `Unrecognized columns ignored: ${uniqueUnknown.join(", ")}.`;
  }

  return {
    success: true,
    mapped,
    errors: errors.length > 0 ? errors : null,
    warning: warning || null,
  };
}
