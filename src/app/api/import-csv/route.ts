import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parse } from "csv-parse/sync";
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
  // Already normalized
  normLookup[alias] = col;
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
  "AVAILABLE", "ALLOCATED", "DEFECTIVE", "RETIRED",
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

  if (!file.name.endsWith(".csv")) {
    return NextResponse.json(
      { success: false, error: "Only .csv files are supported." },
      { status: 400 }
    );
  }

  const text = await file.text();
  let records: string[][];
  try {
    records = parse(text, { skip_empty_lines: true }) as string[][];
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to parse CSV file. Check the file format." },
      { status: 400 }
    );
  }

  if (records.length < 2) {
    return NextResponse.json(
      { success: false, error: "CSV must have a header row and at least one data row." },
      { status: 400 }
    );
  }

  const headers = records[0];
  const unknownHeaders: string[] = [];
  let imported = 0;
  const errors: string[] = [];

  for (let r = 1; r < records.length; r++) {
    const row = records[r];
    if (row.length === 0 || row.every(c => c.trim() === "")) continue;

    const data = buildPrismaData(headers, row, unknownHeaders);

    if (!data.serialNumber) {
      errors.push(`Row ${r + 1}: missing Serial Number, skipped`);
      continue;
    }

    if (!data.model && data.laptopModel) {
      data.model = data.laptopModel;
    }

    if (!data.model) {
      errors.push(`Row ${r + 1}: missing Model, skipped`);
      continue;
    }

    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== null && v !== undefined)
    );

    try {
      await prisma.inventoryItem.create({ data: cleanData as any });
      imported++;
    } catch (e: any) {
      if (e?.code === "P2002") {
        errors.push(`Row ${r + 1}: Serial Number "${data.serialNumber}" already exists, skipped`);
      } else {
        errors.push(`Row ${r + 1}: ${e?.message ?? "Unknown error"}`);
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
