import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-/()]+/g, " ").replace(/\s+/g, " ").trim();
}

const baseMapping: Record<string, string> = {
  "Serial Number": "serialNumber",
  "Model": "model",
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
  // Serial Number
  "serial no": "serialNumber",
  "serial no.": "serialNumber",
  "serial number": "serialNumber",
  "s no": "serialNumber",

  // Employee
  "employee name": "employeeName",
  "name of the employee": "employeeName",
  "emp name": "employeeName",
  "engineer name": "employeeName",

  // Model / Product
  "product": "model",

  // Owner / Entity / Partner
  "owner of the asset": "partner",
  "pwcentity": "entity",
  "pwc entity": "entity",

  // Provisioning
  "provisioning location": "userBaseLocation",
  "provisioned date": "requestDate",
  "lot received date": "requestDate",

  // Provision Status
  "master provision status 1": "processStatus",
  "provision status 1": "processStatus",
  "master provision sub status": "trackingSubStatus",
  "provisioned sub status": "trackingSubStatus",

  // Warehouse
  "current warehouse location": "invoicingWarehouse",
  "warehouse location": "invoicingWarehouse",

  // Remarks
  "asset remarks": "remark",
  "remarks": "remark",

  // Image
  "pwc image": "imageType",

  // Shipping / Delivery
  "shipping date": "deliveryDate",

  // Storage
  "storage status": "status",

  // Courier / Vendor
  "courier name": "vendor",

  // Docket
  "docket #": "docketNumber",
  "docket no": "docketNumber",
  "docket number": "docketNumber",

  // City
  "location city": "city",
  "location - city": "city",

  // Delivery Challan
  "delivey challan": "dcNumber",
  "delivery challan": "dcNumber",
  "dc number": "dcNumber",
  "dc no": "dcNumber",

  // Warranty
  "warranty end date": "warrantyEndPeriod",

  // WS1
  "serial no in ws1": "serialNoInWs1",
  "ws1 serial no": "serialNoInWs1",
  "ws1 serial": "serialNoInWs1",
  "date of ws1 update": "dateOfWs1Update",
  "ws1 update date": "dateOfWs1Update",
  "machine ws1 status": "machineWs1Status",
  "ws1 status": "machineWs1Status",

  // Invoice Product
  "invoice product discription": "invoiceProductDescription",
  "invoice product description": "invoiceProductDescription",
  "product description": "invoiceProductDescription",

  // Email
  "email recieved hour": "emailReceivedHour",
  "email received hour": "emailReceivedHour",
  "email id": "emailId",

  // Delivery TAT
  "delivery tat in days": "deliveryTatDays",
  "delivery tat": "deliveryTatDays",
  "tat days": "deliveryTatDays",

  // Actual Delivery
  "actual delivery pod date": "actualDeliveryDate",
  "actual delivery date": "actualDeliveryDate",
  "pod date": "actualDeliveryDate",

  // Customer Instruction
  "customer instruction doc": "customerInstructionDoc",
  "customer instructions": "customerInstructionDoc",

  // Accessory
  "accessory headset mouse yes no": "accessoryHeadsetMouse",
  "accessory headset mouse": "accessoryHeadsetMouse",

  // Pickup
  "pick up date": "pickupDate",
  "pickup date": "pickupDate",

  // Laptop
  "laptop make": "laptopMake",
  "laptop model": "laptopModel",

  // Warranty
  "warranty period": "warrantyPeriod",
  "warranty end period": "warrantyEndPeriod",

  // Sticker
  "sticker colour": "stickerColour",
  "sticker color": "stickerColour",

  // Invoicing Warehouse
  "invoicing warehouse": "invoicingWarehouse",

  // Tracking
  "tracking status": "trackingStatus",
  "tracking sub status": "trackingSubStatus",

  // Delivered Location
  "delivered location": "deliveredLocation",
  "delivery location": "deliveredLocation",

  // Delivery Date
  "delivery date": "deliveryDate",
  "request date": "requestDate",

  // SLA
  "sla start date": "slaStartDate",
  "cut off status": "cutOffStatus",
  "cut-off status": "cutOffStatus",
  "oda location": "odaLocation",
  "sla missed met": "slaStatus",
  "sla missed or met": "slaStatus",
  "sla miss met": "slaStatus",
  "state sla": "slaState",
  "state (sla)": "slaState",

  // Pincode / Address
  "pin code": "pinCode",
  "pincode": "pinCode",
  "land mark": "landMark",
  "landmark": "landMark",
  "shipping address": "shippingAddress",
  "user base location": "userBaseLocation",
  "base location": "userBaseLocation",

  // Image
  "image type": "imageType",

  // Mobile
  "mobile number": "mobileNumber",
  "phone number": "mobileNumber",
  "alternate phone number": "alternatePhoneNumber",
  "alt phone number": "alternatePhoneNumber",
  "alternate phone": "alternatePhoneNumber",
  "alternate mobile number": "alternatePhoneNumber",

  // Invoiced
  "invoiced quantity": "invoicedQuantity",
  "acceptance date": "laptopAcceptanceDate",
  "laptop acceptance date": "laptopAcceptanceDate",
  "services start date": "servicesStartDate",

  // Box / Check / Status
  "box serial no": "boxSerialNo",
  "box serial": "boxSerialNo",
  "check": "checkField",
  "status 1": "csvStatus",
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
  return normLookup[n];
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

async function parseFile(file: File): Promise<{ headers: string[]; records: string[][] }> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    const text = await file.text();
    const parsed = parse(text, { skip_empty_lines: true }) as string[][];
    if (parsed.length < 2) {
      throw new Error("File must have a header row and at least one data row.");
    }
    return { headers: parsed[0], records: parsed.slice(1) };
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

    const headers = (json[0] as string[]).map(h => String(h ?? ""));
    const records = json.slice(1).map((row: any) =>
      (row as any[]).map((cell: any) => cell?.toString() ?? "")
    );
    return { headers, records };
  }

  throw new Error("Unsupported file format. Please upload a .csv or .xlsx file.");
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Admin access required." },
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

  let headers: string[];
  let records: string[][];
  try {
    ({ headers, records } = await parseFile(file));
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || "Failed to parse file." },
      { status: 400 }
    );
  }

  const unknownHeaders: string[] = [];
  let imported = 0;
  const errors: string[] = [];
  const BATCH_SIZE = 500;

  const rows: { data: Record<string, unknown>; rowNum: number }[] = [];
  for (let r = 0; r < records.length; r++) {
    const row = records[r];
    if (row.length === 0 || row.every(c => c.trim() === "")) continue;

    const data = buildPrismaData(headers, row, unknownHeaders);

    if (!data.serialNumber || String(data.serialNumber).trim() === "") {
      data.serialNumber = `AUTO-${Date.now()}-${r + 2}`;
    }

    if (!data.model && data.laptopModel) {
      data.model = data.laptopModel;
    }

    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== null && v !== undefined)
    );

    const hasEmployee = cleanData.employeeName && String(cleanData.employeeName).trim() !== "";
    const hasTracking = cleanData.trackingStatus && String(cleanData.trackingStatus).trim() !== "";
    if ((hasEmployee || hasTracking) && !cleanData.status) {
      cleanData.status = "ALLOCATED";
    }

    rows.push({ data: cleanData, rowNum: r + 2 });
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      const result = await prisma.inventoryItem.createMany({
        data: batch.map(b => b.data as any),
        skipDuplicates: true,
      });
      imported += result.count;
    } catch (e: any) {
      for (const item of batch) {
        try {
          await prisma.inventoryItem.create({ data: item.data as any });
          imported++;
        } catch (err: any) {
          if (err?.code === "P2002") {
            errors.push(`Row ${item.rowNum}: Serial Number "${item.data.serialNumber}" already exists, skipped`);
          } else {
            errors.push(`Row ${item.rowNum}: ${err?.message ?? "Unknown error"}`);
          }
        }
      }
    }
  }

  revalidatePath("/dashboard/inventory");

  const uniqueUnknown = [...new Set(unknownHeaders)];
  let warning = "";
  if (uniqueUnknown.length > 0) {
    warning = `Unrecognized columns ignored: ${uniqueUnknown.join(", ")}.`;
  }

  return NextResponse.json({
    success: true,
    imported,
    errors: errors.length > 0 ? errors : null,
    warning: warning || null,
  });
}
