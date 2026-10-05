import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { normalizeOdaLocation } from "@/lib/location-utils";
import { resolveReversePickupSla } from "@/lib/reverse-pickup-sla";
import { nextSequenceNumber } from "@/lib/sequence-number";
import { toDenseRow, toDenseRows } from "@/lib/sheet-cells";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

const skippedHeaders = new Set([
  "process", "next ship to user", "dispatch date", "delivery date",
]);

const baseMapping: Record<string, string> = {
  "Request Number": "requestNumber",
  "Serial Number": "serialNumber",
  "Employee Name": "employeeName",
  "Email ID": "emailId",
  "Mobile Number": "mobileNumber",
  "Contact": "contact",
  "Model": "model",
  "Entity": "entity",
  "Type": "type",
  "Image Type": "imageType",
  "Accessories": "accessories",
  "Reason": "reason",
  "Pickup Address": "pickupAddress",
  "Location Address": "pickupAddress",
  "Shipping Address": "pickupAddress",
  "Landmark": "landmark",
  "Land Mark": "landmark",
  "City": "city",
  "State": "state",
  "Pin Code": "pinCode",
  "Year": "year",
  "SR No": "srNo",
  "Request Date": "requestDateHp",
  "Request Date (HP)": "requestDateHp",
  "Employee ID": "employeeId",
  "Alternate ID": "alternateId",
  "Last Working Day": "lastWorkingDay",
  "Warehouse Location": "warehouseLocation",
  "Warehouse": "warehouseLocation",
  "Warehouse Details": "warehouseLocation",
  "Display Status": "displayStatus",
  "Status(Received, Pickup Pending, Pickup Initiated)": "displayStatus",
  "ETA": "eta",
  "ETA (Pickup)": "eta",
  "Future Date Pickup": "futureDatePickup",
  "Dependancy": "dependency",
  "Dependency": "dependency",
  "Remarks": "remarks",
  "Courier Name": "courierName",
  "Docket Number": "docketNumber",
  "Docket No": "docketNumber",
  "Pickup Date": "pickupDate",
  "SRN No": "srnNo",
  "E Way bill No": "eWayBillNo",
  "E-Way Bill No": "eWayBillNo",
  "ETA for unit to be received": "etaForUnitReceived",
  "Case Age": "caseAge",
  "Blancco Yes/No": "blanccoYesNo",
  "Blancco Date": "blanccoDate",
  "Blanco Clear Result": "blancoClearResult",
  "Blanco Clear Remarks": "blancoClearRemarks",
  "Blanco Clear Date": "blancoClearDate",
  "Blanco Clear By": "blancoClearBy",
  "Blanco Purge Result": "blancoPurgeResult",
  "Blanco Purge Remarks": "blancoPurgeRemarks",
  "Blanco Purge Date": "blancoPurgeDate",
  "Blanco Purge By": "blancoPurgeBy",
  "Blanco Certificate URL": "blancoCertificateUrl",
  "Blanco Certificate Date": "blancoCertificateDate",
  "Case ID": "caseId",
  "Issue Reported": "issueReported",
  "Replacement Part": "replacementPart",
  "Exception Remarks": "exceptionRemarks",
  "Remark": "remark",
  "Provisioning Status": "provisioningStatus",
  "Email Recieved Hour": "emailReceivedHour",
  "Cut Off Status": "cutOffStatus",
  "SLA Start Date": "slaStartDate",
  "State (SLA)": "slaState",
  "Zone (1)": "zone1",
  "Tier 1": "tier1",
  "ODA Location": "odaLocation",
  "TAT": "tat",
  "Delivery TAT ": "deliveryTat",
  "Actual Delivery/POD Date": "actualDeliveryPodDate",
  "Expected Pickup Date": "expectedPickupDate",
  "SLA": "sla",
  "Laptop Acceptance Date": "laptopAcceptanceDate",
  "DC No": "dcNo",
  "Receiver Serial No": "receiverSerialNo",
  "Receiver S NO Entity": "receiverSnEntity",
  "Receiver's Name": "receivedBy",
  "Final Disposition": "finalDisposition",
};

const aliases: Record<string, string> = {
  "employee name": "employeeName",
  "emp name": "employeeName",
  "name of user": "employeeName",
  "serial number": "serialNumber",
  "s no": "serialNumber",
  "serial no": "serialNumber",
  "mobile": "mobileNumber",
  "phone": "mobileNumber",
  "phone number": "mobileNumber",
  "contact number": "mobileNumber",
  "user contact details": "mobileNumber",
  "email": "emailId",
  "email id": "emailId",
  "laptop model": "model",
  "product": "model",
  "pick up address": "pickupAddress",
  "shipping address": "pickupAddress",
  "location address": "pickupAddress",
  "address": "pickupAddress",
  "pincode": "pinCode",
  "postal code": "pinCode",
  "warehouse": "warehouseLocation",
  "warehouse loc": "warehouseLocation",
  "warehouse detail": "warehouseLocation",
  "courier": "courierName",
  "courier name": "courierName",
  "docket": "docketNumber",
  "docket no": "docketNumber",
  "tracking number": "docketNumber",
  "land mark": "landmark",
  "image": "imageType",
  "image type": "imageType",
  "sr no": "srNo",
  "sr #": "srNo",
  "request date": "requestDateHp",
  "request date hp": "requestDateHp",
  "employee id": "employeeId",
  "alternate id": "alternateId",
  "last working day": "lastWorkingDay",
  "future date": "futureDatePickup",
  "pickup date": "pickupDate",
  "case id": "caseId",
  "case": "caseId",
  "issue": "issueReported",
  "issue reported": "issueReported",
  "replacement part": "replacementPart",
  "disposition": "finalDisposition",
  "final disposition": "finalDisposition",
  "provisioning status": "provisioningStatus",
  "e way bill no": "eWayBillNo",
  "e-way bill no": "eWayBillNo",
  "eta for unit to be received": "etaForUnitReceived",
  "blancco yes/no": "blanccoYesNo",
  "blancco yes no": "blanccoYesNo",
  "blanco clear result": "blancoClearResult",
  "blanco clear remarks": "blancoClearRemarks",
  "blanco clear date": "blancoClearDate",
  "blanco clear by": "blancoClearBy",
  "blanco purge result": "blancoPurgeResult",
  "blanco purge remarks": "blancoPurgeRemarks",
  "blanco purge date": "blancoPurgeDate",
  "blanco purge by": "blancoPurgeBy",
  "blanco certificate url": "blancoCertificateUrl",
  "blanco certificate date": "blancoCertificateDate",
  "dependancy": "dependency",
  "dc no": "dcNo",
  "receiver serial no": "receiverSerialNo",
  "receiver s no entity": "receiverSnEntity",
  "state (sla)": "slaState",
  "zone (1)": "zone1",
  "tier 1": "tier1",
  "delivery tat": "deliveryTat",
  "actual delivery/pod date": "actualDeliveryPodDate",
  "expected pickup date": "expectedPickupDate",
  "laptop acceptance date": "laptopAcceptanceDate",
  "email recieved hour": "emailReceivedHour",
  "cut off status": "cutOffStatus",
  "sla start date": "slaStartDate",
  "oda location": "odaLocation",
  "case age": "caseAge",
  "exception remarks": "exceptionRemarks",
  "alternate phone number": "alternatePhoneNumber",
  "receiver name": "receivedBy",
  "received by": "receivedBy",
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
  if (skippedHeaders.has(n)) return undefined;
  return normLookup[n];
}

const dateFields = new Set([
  "requestDateHp", "lastWorkingDay", "eta", "futureDatePickup",
  "pickupDate", "inspectionDate", "receivedDate", "qcDate",
  "blanccoDate", "blancoCertificateDate", "actualDeliveryPodDate",
  "laptopAcceptanceDate", "etaForUnitReceived", "slaStartDate",
  "expectedPickupDate", "blancoClearDate", "blancoPurgeDate",
]);

// User-facing fields can repeat in the file (e.g. user pickup block vs warehouse
// shipping block). The FIRST occurrence (user data) must win — the later
// warehouse/dup column must not overwrite it.
const firstWinsFields = new Set([
  "pickupAddress", "landmark", "city", "state", "pinCode",
  "accessories", "entity", "employeeName", "imageType", "reason",
  "receiverSerialNo", "receiverSnEntity", "warehouseLocation", "type",
]);

const intFields = new Set([
  "year",
]);

function excelSerialToDate(serial: number): Date {
  return new Date((serial - 25569) * 86400000);
}

function parseValue(value: string, field: string): unknown {
  if (value === "" || value === undefined || value === null) return null;
  if (dateFields.has(field)) {
    const num = Number(value);
    if (!isNaN(num) && num > 30000 && num < 60000 && String(Math.round(num)) === value.trim()) {
      return excelSerialToDate(num);
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (intFields.has(field)) {
    const n = parseInt(value, 10);
    return isNaN(n) ? null : n;
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
    const header = (headers[i] ?? "").trim();
    const column = resolvedMap.get(i);
    if (!column) {
      unknownHeaders.push(header);
      continue;
    }
    const parsed = parseValue(row[i]?.trim() ?? "", column);
    if (parsed !== null && parsed !== undefined && parsed !== "") {
      if (firstWinsFields.has(column) && data[column] !== undefined) {
        continue;
      }
      data[column] = parsed;
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
  const headerMapping: { header: string; field: string | undefined }[] = [];
  const unknownHeaders: string[] = [];

  for (let i = 0; i < headers.length; i++) {
    const header = (headers[i] ?? "").trim();
    const column = resolveColumn(header);
    if (column) {
      resolvedMap.set(i, column);
      headerMapping.push({ header, field: column });
    } else {
      unknownHeaders.push(header);
      headerMapping.push({ header, field: undefined });
    }
  }

  const errors: string[] = [];

  // Numbering continues from the highest RPU- number already stored. Counting
  // rows instead would hand out numbers that were used and later deleted, which
  // collides on the unique requestNumber column.
  let requestCounter = await nextSequenceNumber({
    table: "reverse_pickup_requests",
    column: "requestNumber",
    valuePattern: /^RPU-([0-9]+)$/,
  });

  const rows: { data: Record<string, unknown>; rowNum: number }[] = [];
  for (let r = 0; r < records.length; r++) {
    const row = records[r];
    if (row.length === 0 || row.every(c => (c ?? "").trim() === "")) continue;

    const data = buildPrismaData(headers, row, unknownHeaders, resolvedMap);

    data.requestNumber = `RPU-${String(requestCounter).padStart(4, "0")}`;
    requestCounter++;
    data.status = "REQUESTED";

    if (data.odaLocation !== undefined && data.odaLocation !== null) {
      data.odaLocation = normalizeOdaLocation(String(data.odaLocation));
    }

    rows.push({ data, rowNum: r + 2 });
  }

  // ── SERIAL NUMBER → INVENTORY LOOKUP (auto-fill user details, chunked) ──
  const allSerials = [...new Set(
    rows.map(r => String(r.data.serialNumber ?? "").trim()).filter(Boolean)
  )];

  const inventoryMap = new Map<string, any>();
  const CHUNK = 500;
  for (let c = 0; c < allSerials.length; c += CHUNK) {
    const chunk = allSerials.slice(c, c + CHUNK);
    const items = await prisma.inventoryItem.findMany({
      where: { serialNumber: { in: chunk } },
      select: {
        serialNumber: true, model: true, entity: true, imageType: true,
        employeeName: true, emailId: true, mobileNumber: true,
        shippingAddress: true, landMark: true, city: true, state: true, pinCode: true,
      },
    });
    for (const item of items) {
      inventoryMap.set(item.serialNumber, item);
    }
  }

  // Filter out rows with no serial number
  const validRows: typeof rows = [];
  for (const row of rows) {
    const sn = String(row.data.serialNumber ?? "").trim();
    if (!sn) {
      errors.push(`Row ${row.rowNum}: Serial number is empty`);
      continue;
    }
    validRows.push(row);
  }

  // Auto-fill from inventory + skip missing serial numbers
  const rowsToInsert: typeof rows = [];
  for (const row of validRows) {
    const sn = String(row.data.serialNumber ?? "").trim();
    const item = inventoryMap.get(sn);
    if (!item) {
      errors.push(`Row ${row.rowNum}: Serial number "${sn}" not found in inventory`);
      continue;
    }

    if (!row.data.model && item.model) row.data.model = item.model;
    if (!row.data.entity && item.entity) row.data.entity = item.entity;
    if (!row.data.imageType && item.imageType) row.data.imageType = item.imageType;
    if (!row.data.employeeName && item.employeeName) row.data.employeeName = item.employeeName;
    if (!row.data.emailId && item.emailId) row.data.emailId = item.emailId;
    if (!row.data.mobileNumber && item.mobileNumber) row.data.mobileNumber = item.mobileNumber;
    if (!row.data.pickupAddress && item.shippingAddress) row.data.pickupAddress = item.shippingAddress;
    if (!row.data.landmark && item.landMark) row.data.landmark = item.landMark;
    if (!row.data.city && item.city) row.data.city = item.city;
    if (!row.data.state && item.state) row.data.state = item.state;
    if (!row.data.pinCode && item.pinCode) row.data.pinCode = item.pinCode;

    // Run after the inventory autofill, because city/state drive zone, tier and
    // TAT. Derived values win over whatever the spreadsheet carried, so an
    // imported sheet can never disagree with the location it was imported for.
    const sla = resolveReversePickupSla({
      emailReceivedHour: (row.data.emailReceivedHour as string) ?? null,
      city: (row.data.city as string) ?? null,
      state: (row.data.state as string) ?? null,
      odaLocation: (row.data.odaLocation as string) ?? null,
      pickupDate: (row.data.pickupDate as Date) ?? null,
      slaStartDate: (row.data.slaStartDate as Date) ?? null,
      // Rows without a usable email hour still need an expected date, so anchor
      // them on the date the request was raised rather than on the import date.
      fallbackStartDate: (row.data.requestDateHp as Date) ?? new Date(),
    });
    Object.assign(row.data, sla);

    // Skip rows missing required fields
    if (!row.data.model || !String(row.data.model).trim()) {
      errors.push(`Row ${row.rowNum}: Skipped - model not found for "${sn}"`);
      continue;
    }
    if (!row.data.employeeName || !String(row.data.employeeName).trim()) {
      errors.push(`Row ${row.rowNum}: Skipped - employee name not found for "${sn}"`);
      continue;
    }
    if (!row.data.pickupAddress || !String(row.data.pickupAddress).trim()) {
      errors.push(`Row ${row.rowNum}: Skipped - pickup address not found for "${sn}"`);
      continue;
    }

    rowsToInsert.push(row);
  }

  let imported = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
    const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
    const batchData = batch.map(r => r.data);
    try {
      await prisma.reversePickupRequest.createMany({ data: batchData as any[] });
      imported += batchData.length;
    } catch {
      // Batch failed — retry one by one
      for (const item of batch) {
        try {
          await prisma.reversePickupRequest.create({ data: item.data as any });
          imported++;
        } catch {
          errors.push(`Row ${item.rowNum}: Failed for "${item.data.serialNumber}"`);
        }
      }
    }
  }

  revalidatePath("/dashboard/reverse-pickup");

  const uniqueUnknown = [...new Set(unknownHeaders)];
  const warning = uniqueUnknown.length > 0
    ? `Unrecognized columns ignored: ${uniqueUnknown.join(", ")}.`
    : "";

  return NextResponse.json({
    success: true,
    imported,
    errors: errors.length > 0 ? errors : null,
    warning: warning || null,
  });
}
