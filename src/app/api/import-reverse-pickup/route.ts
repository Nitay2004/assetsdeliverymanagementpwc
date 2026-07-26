import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";

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
  "dependancy": "dependency",
  "dc no": "dcNo",
  "receiver serial no": "receiverSerialNo",
  "receiver s no entity": "receiverSnEntity",
  "state (sla)": "slaState",
  "zone (1)": "zone1",
  "tier 1": "tier1",
  "delivery tat": "deliveryTat",
  "actual delivery/pod date": "actualDeliveryPodDate",
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
  "laptopAcceptanceDate", "etaForUnitReceived",
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
    const header = headers[i].trim();
    const column = resolvedMap.get(i);
    if (!column) {
      unknownHeaders.push(header);
      continue;
    }
    const parsed = parseValue(row[i]?.trim() ?? "", column);
    if (parsed !== null && parsed !== undefined && parsed !== "") {
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

  const resolvedMap = new Map<number, string>();
  const headerMapping: { header: string; field: string | undefined }[] = [];
  const unknownHeaders: string[] = [];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].trim();
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

  const totalExisting = await prisma.reversePickupRequest.count();
  let requestCounter = totalExisting + 1;

  const rows: { data: Record<string, unknown>; rowNum: number }[] = [];
  for (let r = 0; r < records.length; r++) {
    const row = records[r];
    if (row.length === 0 || row.every(c => c.trim() === "")) continue;

    const data = buildPrismaData(headers, row, unknownHeaders, resolvedMap);

    data.requestNumber = `RPU-${String(requestCounter).padStart(4, "0")}`;
    requestCounter++;
    data.status = "REQUESTED";

    rows.push({ data, rowNum: r + 2 });
  }

  // ── SERIAL NUMBER → INVENTORY LOOKUP (auto-fill user details) ──
  const allSerials = [...new Set(
    rows.map(r => String(r.data.serialNumber ?? "").trim()).filter(Boolean)
  )];

  const inventoryItems = allSerials.length > 0 ? await prisma.inventoryItem.findMany({
    where: { serialNumber: { in: allSerials } },
    select: {
      serialNumber: true, model: true, entity: true, imageType: true,
      employeeName: true, emailId: true, mobileNumber: true,
      shippingAddress: true, landMark: true, city: true, state: true, pinCode: true,
    },
  }) : [];

  const inventoryMap = new Map(inventoryItems.map(item => [item.serialNumber, item]));

  for (const row of rows) {
    const sn = String(row.data.serialNumber ?? "").trim();
    if (!sn) {
      errors.push(`Row ${row.rowNum}: Serial number is empty`);
      continue;
    }

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
  }

  let imported = 0;
  const BATCH_SIZE = 200;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchData = batch.map(r => r.data);
    try {
      await prisma.reversePickupRequest.createMany({ data: batchData as any[] });
      imported += batchData.length;
    } catch (err: any) {
      for (const item of batch) {
        try {
          await prisma.reversePickupRequest.create({ data: item.data as any });
          imported++;
        } catch (singleErr: any) {
          const msg = singleErr?.cause?.message ?? singleErr?.message ?? "Unknown error";
          errors.push(`Row ${item.rowNum}: Failed to create request for "${item.data.serialNumber}" - ${msg}`);
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
