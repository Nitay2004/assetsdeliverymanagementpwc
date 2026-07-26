import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

const fieldKeywords: [string, string[]][] = [
  // PRIORITY ORDER MATTERS — more specific fields first
  ["serialNumber",     ["serial", "s no", "s.no", "sn", "serial number", "serial no", "serial no.", "s/n", "serialno", "serial number no"]],
  ["serialNoInWs1",    ["ws1 serial", "serial ws1", "serial in ws1"]],
  ["boxSerialNo",      ["box serial", "box sn", "box number"]],
  ["laptopModel",      ["laptop model"]],
  ["laptopMake",       ["laptop make", "laptop brand", "laptop manufacturer"]],
  ["invoiceProductDescription", ["invoice product", "invoice description", "product description", "invoice discription", "invoice product description", "invoice product discription"]],
  ["employeeName",     ["employee", "emp name", "engineer", "user name", "assigned to", "owner name", "name of the employee", "engineer name"]],
  ["emailId",          ["email", "email id", "email address", "mail id", "e mail"]],
  ["emailReceivedHour",["email received", "received hour", "email hour", "email recieved"]],
  ["mobileNumber",     ["mobile", "phone number", "contact number", "mobile number", "mobile no", "contact no", "phone no", "cell"]],
  ["alternatePhoneNumber", ["alternate phone", "alt phone", "alternate number", "alternate mobile", "alt mobile", "secondary phone", "secondary mobile"]],
  ["shippingAddress",  ["shipping address", "delivery address", "ship to address", "ship to", "address line"]],
  ["landMark",         ["landmark", "land mark", "near", "nearby"]],
  ["city",             ["city", "town", "location city", "location city"]],
  ["state",            ["state", "region"]],
  ["pinCode",          ["pin", "pincode", "pin code", "postal code", "zip", "zip code"]],
  ["partner",          ["partner", "owner of the asset", "asset owner", "owner"]],
  ["entity",           ["entity", "pwc entity", "pwcentity", "company"]],
  ["partNo",           ["part no", "part number", "part no.", "part#", "part #", "pn", "hp part", "material", "material number", "partno", "partnumber", "part num", "part no#", "material no", "material no."]],
  ["model",            ["model", "product", "product name", "machine", "device"]],
  ["specs",            ["spec", "specs", "specification", "configuration", "config"]],
  ["purpose",          ["purpose", "usage", "reason", "why"]],
  ["count",            ["count", "qty", "quantity", "no of", "num", "total"]],

  // Status fields (must be before generic status)
  ["processStatus",    ["process status", "master provision status", "provision status", "master provision", "provisioning status"]],
  ["trackingSubStatus",["tracking sub", "sub status", "sub-status", "provisioned sub status", "sub status"]],
  ["trackingStatus",   ["tracking status", "tracking", "shipment status", "current tracking"]],
  ["csvStatus",        ["status 1", "status_1", "csv status"]],
  ["cutOffStatus",     ["cut off", "cut-off", "cutoff", "cut off status"]],
  ["slaStatus",        ["sla missed", "sla met", "missed met", "miss met", "sla miss", "sla status", "sla missed met"]],
  ["machineWs1Status", ["ws1 status", "ws1", "machine ws1", "workspace one"]],
  ["status",           ["status", "storage status", "storage", "condition", "current status", "asset status"]],

  // Dates
  ["warrantyEndPeriod",     ["warranty end", "warranty expiry", "warranty till", "warranty valid till", "warranty upto"]],
  ["warrantyPeriod",        ["warranty period", "warranty term", "warranty", "warranty months", "warranty years"]],
  ["actualDeliveryDate",    ["actual delivery", "pod date", "proof of delivery", "pod"]],
  ["deliveryDate",          ["delivery date", "shipping date", "dispatch date", "deliver date", "ship date"]],
  ["requestDate",           ["request date", "received date", "lot received", "provisioned date", "provision date", "inward date", "request"]],
  ["slaStartDate",          ["sla start", "sla date"]],
  ["laptopAcceptanceDate",  ["acceptance date", "laptop acceptance", "accept date"]],
  ["pickupDate",            ["pickup", "pick up date", "pickup date", "pick up"]],
  ["dateOfWs1Update",       ["ws1 date", "ws1 update", "date of ws1", "ws1 update date"]],
  ["servicesStartDate",     ["services start", "service start", "service begin"]],
  ["date",                  ["date"]],

  // SLA / Location / Zone
  ["userBaseLocation",  ["location", "base location", "provisioning location", "provision location", "work location", "user location", "user base location"]],
  ["deliveredLocation", ["delivered location", "delivery location", "delivered at", "delivery at", "delivered to"]],
  ["invoicingWarehouse",["warehouse", "warehouse location", "invoicing warehouse", "current warehouse", "warehouse loc", "warehouse name"]],
  ["odaLocation",       ["oda", "oda location"]],
  ["zone",              ["zone", "area zone", "region zone"]],
  ["tier",              ["tier", "level", "service tier"]],
  ["tat",               ["tat", "turn around", "turnaround"]],
  ["deliveryTatDays",   ["tat days", "delivery tat", "tat in days", "delivery tat in days"]],

  // Vendor / Docket / DC
  ["vendor",            ["vendor", "courier", "courier name", "service provider", "logistics partner", "carrier", "transporter"]],
  ["docketNumber",      ["docket", "docket number", "docket no", "tracking number", "docket #", "docket no.", "awb", "awb number", "consignment"]],
  ["dcNumber",          ["dc number", "dc no", "dc #", "delivery challan", "delivey challan", "challan number", "challan no", "challan"]],
  ["dc",                ["dc"]],

  // WS1 / Warehouse
  ["dateOfWs1Update",       ["ws1 date", "ws1 update", "date of ws1"]],

  // Remarks
  ["remark",            ["remark", "remarks", "asset remarks", "comments", "notes", "observation"]],
  ["pwcRemarks",        ["pwc remark", "pwc comments", "pwc notes"]],

  // Additional
  ["imageType",         ["image", "pwc image", "image type", "laptop image", "photo"]],
  ["adaptorAdded",      ["adaptor", "adapter", "adaptor added", "adapter added"]],
  ["accessoryHeadsetMouse", ["accessory", "headset", "mouse", "accessory headset", "accessory mouse"]],
  ["stickerColour",     ["sticker", "sticker colour", "sticker color", "sticker col", "sticker shade"]],
  ["checkField",        ["check", "verified", "confirmation", "confirm", "checked"]],
  ["customerInstructionDoc", ["customer instruction", "instruction doc", "customer doc", "instruction"]],
  ["invoicedQuantity",  ["invoiced qty", "invoiced quantity", "invoice qty", "quantity invoiced", "invoiced", "invoice quantity"]],
  ["sr",                ["sr", "sr no", "sequence", "lot no", "inward lot", "lot number", "dev it inward lot", "hp lot", "hp lot number"]],
];

// Score a header against a field's keywords
function scoreHeader(headerNorm: string, keywords: string[]): number {
  let best = 0;
  for (const kw of keywords) {
    if (headerNorm === kw) {
      // Exact match = highest score
      best = Math.max(best, 1000);
    } else if (headerNorm.includes(kw)) {
      // Contains keyword — score by keyword length (longer = more specific = better)
      best = Math.max(best, kw.length * 10);
    } else if (kw.includes(headerNorm) && headerNorm.length >= 3) {
      // Keyword contains header (header is a subset of keyword)
      best = Math.max(best, headerNorm.length * 5);
    }
  }
  return best;
}

function intelligentResolve(header: string): string | undefined {
  const n = normalize(header);
  if (!n) return undefined;

  // 1. Exact match from baseMapping + aliases
  const exact = normLookup[n];
  if (exact) return exact;

  // 2. Keyword-based scoring
  let bestField: string | undefined;
  let bestScore = 0;
  for (const [field, keywords] of fieldKeywords) {
    const score = scoreHeader(n, keywords);
    if (score > bestScore) {
      bestScore = score;
      bestField = field;
    }
  }

  // Require a minimum score to avoid false positives
  if (bestScore >= 20 && bestField) {
    return bestField;
  }

  return undefined;
}

const baseMapping: Record<string, string> = {
  "Serial Number": "serialNumber",
  "Part No": "partNo",
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
  "serial no": "serialNumber",
  "serial no.": "serialNumber",
  "serial number": "serialNumber",
  "s no": "serialNumber",
  "serialno": "serialNumber",
  "s/n": "serialNumber",
  "employee name": "employeeName",
  "name of the employee": "employeeName",
  "emp name": "employeeName",
  "engineer name": "employeeName",
  "product": "model",
  "part no": "partNo",
  "part number": "partNo",
  "partno": "partNo",
  "partnumber": "partNo",
  "part num": "partNo",
  "hp part": "partNo",
  "material no": "partNo",
  "material number": "partNo",
  "owner of the asset": "partner",
  "pwcentity": "entity",
  "pwc entity": "entity",
  "provisioning location": "userBaseLocation",
  "provisioned date": "requestDate",
  "lot received date": "requestDate",
  "master provision status 1": "processStatus",
  "provision status 1": "processStatus",
  "master provision sub status": "trackingSubStatus",
  "provisioned sub status": "trackingSubStatus",
  "current warehouse location": "invoicingWarehouse",
  "warehouse location": "invoicingWarehouse",
  "asset remarks": "remark",
  "remarks": "remark",
  "pwc image": "imageType",
  "shipping date": "deliveryDate",
  "storage status": "status",
  "courier name": "vendor",
  "docket #": "docketNumber",
  "docket no": "docketNumber",
  "docket number": "docketNumber",
  "location city": "city",
  "location - city": "city",
  "delivey challan": "dcNumber",
  "delivery challan": "dcNumber",
  "dc number": "dcNumber",
  "dc no": "dcNumber",
  "warranty end date": "warrantyEndPeriod",
  "serial no in ws1": "serialNoInWs1",
  "ws1 serial no": "serialNoInWs1",
  "ws1 serial": "serialNoInWs1",
  "date of ws1 update": "dateOfWs1Update",
  "ws1 update date": "dateOfWs1Update",
  "machine ws1 status": "machineWs1Status",
  "ws1 status": "machineWs1Status",
  "invoice product discription": "invoiceProductDescription",
  "invoice product description": "invoiceProductDescription",
  "product description": "invoiceProductDescription",
  "email recieved hour": "emailReceivedHour",
  "email received hour": "emailReceivedHour",
  "email id": "emailId",
  "delivery tat in days": "deliveryTatDays",
  "delivery tat": "deliveryTatDays",
  "tat days": "deliveryTatDays",
  "actual delivery pod date": "actualDeliveryDate",
  "actual delivery date": "actualDeliveryDate",
  "pod date": "actualDeliveryDate",
  "customer instruction doc": "customerInstructionDoc",
  "customer instructions": "customerInstructionDoc",
  "accessory headset mouse yes no": "accessoryHeadsetMouse",
  "accessory headset mouse": "accessoryHeadsetMouse",
  "pick up date": "pickupDate",
  "pickup date": "pickupDate",
  "laptop make": "laptopMake",
  "laptop model": "laptopModel",
  "warranty period": "warrantyPeriod",
  "warranty end period": "warrantyEndPeriod",
  "sticker colour": "stickerColour",
  "sticker color": "stickerColour",
  "invoicing warehouse": "invoicingWarehouse",
  "tracking status": "trackingStatus",
  "tracking sub status": "trackingSubStatus",
  "delivered location": "deliveredLocation",
  "delivery location": "deliveredLocation",
  "delivery date": "deliveryDate",
  "request date": "requestDate",
  "sla start date": "slaStartDate",
  "cut off status": "cutOffStatus",
  "cut-off status": "cutOffStatus",
  "oda location": "odaLocation",
  "pin code": "pinCode",
  "pincode": "pinCode",
  "land mark": "landMark",
  "landmark": "landMark",
  "shipping address": "shippingAddress",
  "user base location": "userBaseLocation",
  "base location": "userBaseLocation",
  "image type": "imageType",
  "mobile number": "mobileNumber",
  "phone number": "mobileNumber",
  "alternate phone number": "alternatePhoneNumber",
  "alt phone number": "alternatePhoneNumber",
  "alternate phone": "alternatePhoneNumber",
  "alternate mobile number": "alternatePhoneNumber",
  "invoiced quantity": "invoicedQuantity",
  "acceptance date": "laptopAcceptanceDate",
  "laptop acceptance date": "laptopAcceptanceDate",
  "services start date": "servicesStartDate",
  "box serial no": "boxSerialNo",
  "box serial": "boxSerialNo",
  "check": "checkField",
  "status 1": "csvStatus",
  "sla missed met": "slaStatus",
  "sla missed or met": "slaStatus",
  "sla miss met": "slaStatus",
  "state sla": "slaState",
  "state (sla)": "slaState",
};

const normLookup: Record<string, string> = {};
for (const [raw, col] of Object.entries(baseMapping)) {
  normLookup[normalize(raw)] = col;
}
for (const [alias, col] of Object.entries(aliases)) {
  normLookup[normalize(alias)] = col;
}

function resolveColumn(header: string): string | undefined {
  return intelligentResolve(header);
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
  unknownHeaders: string[],
  resolvedMap: Map<number, string>
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].trim();
    const column = resolvedMap.get(i);
    if (!column) {
      unknownHeaders.push(header);
      continue;
    }
    const parsed = parseValue(row[i]?.trim() ?? "", column);
    if (parsed !== null && parsed !== undefined && parsed !== "") {
      data[column] = parsed;
    } else if (!(column in data)) {
      data[column] = null;
    }
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
  const mode = (formData.get("mode") as string) || "upload";

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

  // Resolve all headers upfront — intelligently
  const resolvedMap = new Map<number, string>();
  const headerMapping: { header: string; field: string | undefined }[] = [];
  const unknownHeaders: string[] = [];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].trim();
    const column = intelligentResolve(header);
    if (column) {
      resolvedMap.set(i, column);
      headerMapping.push({ header, field: column });
    } else {
      unknownHeaders.push(header);
      headerMapping.push({ header, field: undefined });
    }
  }

  const errors: string[] = [];

  const rows: { data: Record<string, unknown>; rowNum: number }[] = [];
  for (let r = 0; r < records.length; r++) {
    const row = records[r];
    if (row.length === 0 || row.every(c => c.trim() === "")) continue;

    const data = buildPrismaData(headers, row, unknownHeaders, resolvedMap);

    if (!data.serialNumber || String(data.serialNumber).trim() === "") {
      errors.push(`Row ${r + 2}: No serial number found, skipped`);
      continue;
    }

    if (!data.model && data.laptopModel) {
      data.model = data.laptopModel;
    }

    rows.push({ data, rowNum: r + 2 });
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

  // ── UPDATE MODE ──
  if (mode === "update") {
    return handleUpdateMode(rows, unknownHeaders, headerMapping, errors);
  }

  // ── UPLOAD MODE (default) ──
  return handleUploadMode(rows, unknownHeaders, headerMapping, errors);
}

const BATCH_SIZE = 200;

const assignmentFields = [
  "employeeName", "emailId", "mobileNumber", "alternatePhoneNumber",
  "shippingAddress", "landMark", "city", "state", "pinCode",
  "purpose", "requestDate", "userBaseLocation", "imageType", "count",
  "pwcRemarks", "trackingStatus", "trackingSubStatus", "dcNumber",
  "docketNumber", "deliveryDate",
];

const inventoryItemUpdateFields = [
  "employeeName", "emailId", "mobileNumber", "alternatePhoneNumber",
  "shippingAddress", "landMark", "city", "state", "pinCode",
  "purpose", "requestDate", "userBaseLocation", "imageType", "count",
  "pwcRemarks", "trackingStatus", "trackingSubStatus", "dcNumber",
  "docketNumber", "deliveryDate", "partner", "sr", "entity",
  "laptopMake", "laptopModel", "invoiceProductDescription", "partNo",
  "description", "emailReceivedHour", "cutOffStatus", "slaStartDate",
  "slaState", "zone", "tier", "odaLocation", "tat", "deliveryTatDays",
  "actualDeliveryDate", "slaStatus", "laptopAcceptanceDate", "warrantyPeriod",
  "warrantyEndPeriod", "adaptorAdded", "accessoryHeadsetMouse", "stickerColour",
  "dc", "vendor", "deliveredLocation", "processStatus", "machineWs1Status",
  "serialNoInWs1", "dateOfWs1Update", "servicesStartDate", "invoicingWarehouse",
  "boxSerialNo", "checkField", "remark", "date", "csvStatus",
  "model", "specs", "invoicedQuantity", "customerInstructionDoc", "pickupDate",
];

function buildAssignmentRecord(itemId: string, data: Record<string, unknown>): Record<string, unknown> {
  const record: Record<string, unknown> = { inventoryItemId: itemId, assignedAt: new Date() };
  for (const f of assignmentFields) {
    record[f] = (data as any)[f] ?? null;
  }
  return record;
}

function buildUpdateData(data: Record<string, unknown>): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};
  for (const f of inventoryItemUpdateFields) {
    if (f in data && data[f] !== undefined) {
      updateData[f] = data[f];
    }
  }
  if (updateData.employeeName && String(updateData.employeeName).trim() !== "") {
    updateData.status = "ALLOCATED";
  }
  return updateData;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function handleUpdateMode(
  rows: { data: Record<string, unknown>; rowNum: number }[],
  unknownHeaders: string[],
  headerMapping: { header: string; field: string | undefined }[],
  errors: string[]
) {
  const allSerials = [...new Set(
    rows.map(r => String(r.data.serialNumber ?? "").trim()).filter(Boolean)
  )];

  const existingItems = await prisma.inventoryItem.findMany({
    where: { serialNumber: { in: allSerials } },
    select: {
      id: true, serialNumber: true,
      employeeName: true, emailId: true, mobileNumber: true, alternatePhoneNumber: true,
      shippingAddress: true, landMark: true, city: true, state: true, pinCode: true,
      purpose: true, requestDate: true, userBaseLocation: true, imageType: true,
      count: true, pwcRemarks: true, trackingStatus: true, trackingSubStatus: true,
      dcNumber: true, docketNumber: true, deliveryDate: true,
    },
  });

  const existingMap = new Map(existingItems.map(item => [item.serialNumber, item]));

  const historyRecords: Record<string, unknown>[] = [];
  const updateOps: { id: string; data: Record<string, unknown> }[] = [];
  let notFound = 0;

  for (const item of rows) {
    const sn = String(item.data.serialNumber ?? "").trim();
    const existing = existingMap.get(sn);

    if (!existing) {
      notFound++;
      errors.push(`Row ${item.rowNum}: Serial number "${sn}" not found in inventory`);
      continue;
    }

    if (existing.employeeName) {
      historyRecords.push({
        inventoryItemId: existing.id,
        employeeName: existing.employeeName,
        emailId: existing.emailId,
        mobileNumber: existing.mobileNumber,
        alternatePhoneNumber: existing.alternatePhoneNumber,
        shippingAddress: existing.shippingAddress,
        landMark: existing.landMark,
        city: existing.city,
        state: existing.state,
        pinCode: existing.pinCode,
        purpose: existing.purpose,
        requestDate: existing.requestDate,
        userBaseLocation: existing.userBaseLocation,
        imageType: existing.imageType,
        count: existing.count,
        pwcRemarks: existing.pwcRemarks,
        trackingStatus: existing.trackingStatus,
        trackingSubStatus: existing.trackingSubStatus,
        dcNumber: existing.dcNumber,
        docketNumber: existing.docketNumber,
        deliveryDate: existing.deliveryDate,
        assignedAt: new Date(),
      });
    }

    const updateData = buildUpdateData(item.data);
    if (Object.keys(updateData).length > 0) {
      updateOps.push({ id: existing.id, data: updateData });
    }
  }

  // Batch insert history records
  let mapped = 0;
  for (const batch of chunk(historyRecords, BATCH_SIZE)) {
    try {
      const result = await prisma.assignmentRecord.createMany({ data: batch as any[] });
      mapped += result.count;
    } catch (err: any) {
      errors.push(`Failed to save assignment history batch: ${err?.message ?? "Unknown error"}`);
    }
  }

  // Batch update inventory items using transaction
  let updated = 0;
  for (const batch of chunk(updateOps, BATCH_SIZE)) {
    try {
      await prisma.$transaction(
        batch.map(op => prisma.inventoryItem.update({ where: { id: op.id }, data: op.data as any }))
      );
      updated += batch.length;
    } catch (err: any) {
      errors.push(`Failed to update inventory batch: ${err?.message ?? "Unknown error"}`);
    }
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");

  const uniqueUnknown = [...new Set(unknownHeaders)];
  let warning = uniqueUnknown.length > 0 ? `Unrecognized columns ignored: ${uniqueUnknown.join(", ")}.` : "";

  return NextResponse.json({
    success: true,
    updated,
    mapped,
    notFound,
    errors: errors.length > 0 ? errors : null,
    warning: warning || null,
  });
}

async function handleUploadMode(
  rows: { data: Record<string, unknown>; rowNum: number }[],
  unknownHeaders: string[],
  headerMapping: { header: string; field: string | undefined }[],
  errors: string[]
) {
  const allSerials = [...new Set(
    rows.map(r => String(r.data.serialNumber ?? "").trim()).filter(Boolean)
  )];

  const existingItems = await prisma.inventoryItem.findMany({
    where: { serialNumber: { in: allSerials } },
    select: { id: true, serialNumber: true },
  });

  const existingMap = new Map(existingItems.map(item => [item.serialNumber, item.id]));

  // Separate rows into new items and existing items
  const newItems: { data: Record<string, unknown>; rowNum: number }[] = [];
  const existingRows: { data: Record<string, unknown>; rowNum: number; itemId: string }[] = [];

  for (const item of rows) {
    const sn = String(item.data.serialNumber ?? "").trim();
    const itemId = existingMap.get(sn);
    if (itemId) {
      existingRows.push({ ...item, itemId });
    } else {
      newItems.push(item);
    }
  }

  // Batch create new inventory items
  const newItemsData: Record<string, unknown>[] = [];
  const newItemsMeta: { sn: string; rowNum: number }[] = [];

  for (const item of newItems) {
    const sn = String(item.data.serialNumber ?? "").trim();
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
    newItemsData.push(cleanData);
    newItemsMeta.push({ sn, rowNum: item.rowNum });
  }

  // Insert new items in batches and collect their IDs
  const newItemsWithIds: { itemId: string; data: Record<string, unknown>; rowNum: number }[] = [];

  for (let i = 0; i < newItemsData.length; i += BATCH_SIZE) {
    const batchData = newItemsData.slice(i, i + BATCH_SIZE);
    const batchMeta = newItemsMeta.slice(i, i + BATCH_SIZE);
    try {
      await prisma.inventoryItem.createMany({ data: batchData as any[] });
      // Fetch back the IDs
      const batchSerials = batchMeta.map(m => m.sn);
      const created = await prisma.inventoryItem.findMany({
        where: { serialNumber: { in: batchSerials } },
        select: { id: true, serialNumber: true },
      });
      const idMap = new Map(created.map(c => [c.serialNumber, c.id]));
      for (let j = 0; j < batchMeta.length; j++) {
        const id = idMap.get(batchMeta[j].sn);
        if (id) {
          newItemsWithIds.push({ itemId: id, data: batchData[j], rowNum: batchMeta[j].rowNum });
        } else {
          errors.push(`Row ${batchMeta[j].rowNum}: Failed to create item "${batchMeta[j].sn}"`);
        }
      }
    } catch (err: any) {
      for (const meta of batchMeta) {
        errors.push(`Row ${meta.rowNum}: Failed to create item "${meta.sn}" - ${err?.message ?? "Unknown error"}`);
      }
    }
  }

  // Build all assignment records (new + existing)
  const allAssignments: Record<string, unknown>[] = [];
  let mapped = 0;

  for (const item of newItemsWithIds) {
    allAssignments.push(buildAssignmentRecord(item.itemId, item.data));
  }
  for (const item of existingRows) {
    allAssignments.push(buildAssignmentRecord(item.itemId, item.data));
  }

  // Batch insert all assignment records
  for (const batch of chunk(allAssignments, BATCH_SIZE)) {
    try {
      const result = await prisma.assignmentRecord.createMany({ data: batch as any[] });
      mapped += result.count;
    } catch (err: any) {
      errors.push(`Failed to save assignment history batch: ${err?.message ?? "Unknown error"}`);
    }
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");

  const uniqueUnknown = [...new Set(unknownHeaders)];
  let warning = uniqueUnknown.length > 0 ? `Unrecognized columns ignored: ${uniqueUnknown.join(", ")}.` : "";
  const matchedHeaders = headerMapping.filter(h => h.field).map(h => `${h.header} → ${h.field}`);

  return NextResponse.json({
    success: true,
    mapped,
    matched: matchedHeaders,
    errors: errors.length > 0 ? errors : null,
    warning: warning || null,
  });
}
