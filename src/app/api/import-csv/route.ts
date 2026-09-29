import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { normalizeOdaLocation } from "@/lib/location-utils";

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
  ["employeeName",     ["employee", "emp name", "user name", "assigned to", "owner name", "name of the employee"]],
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
  ["model",            ["model", "product name", "machine", "device"]],
  ["specs",            ["spec", "specs", "specification", "configuration", "config"]],
  ["purpose",          ["purpose", "usage", "reason", "why"]],
  ["count",            ["count", "qty", "quantity", "no of", "num", "total"]],

  // Status fields (must be before generic status)
  ["processStatus",    ["process status", "master provision status", "master provision status 1 new", "provision status", "master provision", "provisioning status"]],
  ["trackingSubStatus",["tracking sub", "sub status", "sub-status", "provisioned sub status", "sub status"]],
  ["trackingStatus",   ["tracking status", "tracking", "shipment status", "current tracking"]],
  ["csvStatus",        ["status 1", "status_1", "csv status"]],
  ["cutOffStatus",     ["cut off", "cut-off", "cutoff", "cut off status"]],
  ["slaStatus",        ["sla missed", "sla met", "missed met", "miss met", "sla miss", "sla status", "sla missed met"]],
  ["machineWs1Status", ["ws1 status", "ws1", "machine ws1", "workspace one"]],
  ["status",           ["status", "current status", "asset status"]],

  // Dates
  ["warrantyEndPeriod",     ["warranty end", "warranty expiry", "warranty till", "warranty valid till", "warranty upto"]],
  ["warrantyPeriod",        ["warranty period", "warranty term", "warranty", "warranty months", "warranty years"]],
  ["expectedDeliveryDate",  ["expected delivery", "exp delivery", "expected delivery pod date"]],
  ["actualDeliveryDate",    ["actual delivery", "pod date", "proof of delivery", "pod"]],
  ["deliveryDate",          ["delivery date", "dispatch date", "deliver date", "ship date"]],
  ["requestDate",           ["request date", "received date", "provisioned date", "provision date", "inward date", "request"]],
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
  ["remark",            ["remark", "remarks", "comments", "notes", "observation"]],
  ["pwcRemarks",        ["pwc remark", "pwc comments", "pwc notes"]],

  // Additional
  ["imageType",         ["image", "pwc image", "image type", "laptop image", "photo"]],
  ["adaptorAdded",      ["adaptor", "adapter", "adaptor added", "adapter added"]],
  ["accessoryHeadsetMouse", ["accessory", "headset", "mouse", "accessory headset", "accessory mouse"]],
  ["stickerColour",     ["sticker", "sticker colour", "sticker color", "sticker col", "sticker shade"]],
  ["checkField",        ["check", "verified", "confirmation", "confirmation display", "confirm", "checked"]],
  ["customerInstructionDoc", ["customer instruction", "instruction doc", "customer doc", "instruction"]],
  ["invoicedQuantity",  ["invoiced qty", "invoiced quantity", "invoice qty", "quantity invoiced", "invoiced", "invoice quantity"]],
  ["sr",                ["sr", "sr no", "sequence", "lot no", "inward lot", "lot number", "dev it inward lot", "hp lot", "hp lot number"]],

  // Provisioning asset tracking columns (assets/user master file)
  ["engineerName",          ["engineer", "engineer name", "provisioning engineer"]],
  ["condition",             ["condition", "working", "non working", "working non working"]],
  ["storageStatus",         ["storage status", "storage", "storage condition"]],
  ["rackNo",                ["rack no", "rack", "rack number"]],
  ["devItInwardLotNo",      ["dev it inward lot no", "dev it inward lot", "dev it inward", "inward lot no"]],
  ["lotReceivedDate",       ["lot received date", "lot received", "lot date", "inward lot date"]],
  ["shippingDate",          ["shipping date"]],
  ["assetRemarks",          ["asset remarks", "asset remark"]],
  ["hpLotNumber",           ["hp lot number", "hp lot no", "hp lot"]],
  ["previousImageDate",     ["previous image date", "previous image", "old image date"]],
  ["latestShippedDate",     ["latest shipped date", "latest shipped", "provision image"]],
  ["latestCourierName",     ["latest courier name", "latest courier"]],
  ["latestDocketNumber",    ["latest docket no", "latest docket number", "latest docket"]],
  ["latestTrackingStatus",  ["latest tracking status", "latest tracking"]],
  ["latestEwayBill",        ["latest eway bill", "latest eway", "latest e way bill"]],
  ["latestDeliveryDate",    ["latest delivery date", "latest delivery"]],
  ["latestDc",              ["latest dc", "latest dc no", "latest delivery challan"]],
  ["inwardDate1",           ["inward date 1", "inward date - 1", "inward 1"]],
  ["outwardDate1",          ["outward date 1", "outward date - 1", "outward 1"]],
  ["inwardDate2",           ["inward date 2", "inward date - 2", "inward 2"]],
  ["outwardDate2",          ["outward date 2", "outward date - 2", "outward 2"]],
  ["inwardDate3",           ["inward date 3", "inward date - 3", "inward 3"]],
  ["outwardDate3",          ["outward date 3", "outward date - 3", "outward 3"]],
  ["inwardDate4",           ["inward date 4", "inward date - 4", "inward 4"]],
  ["outwardDate4",          ["outward date 4", "outward date - 4", "outward 4"]],
  ["inwardDate5",           ["inward date 5", "inward date - 5", "inward 5"]],
  ["outwardDate5",          ["outward date 5", "outward date - 5", "outward 5"]],
  ["inwardDate6",           ["inward date 6", "inward date - 6", "inward 6"]],
  ["outwardDate6",          ["outward date 6", "outward date - 6", "outward 6"]],
  // Assignment file fields (remote/office assignments)
  ["reqDateToDevIt",        ["req date to dev it", "req date dev it", "request date to dev it"]],
  ["deliveryTatDate",       ["delivery tat date", "tat date"]],
  ["ewayBill",              ["eway bill", "e way bill", "ewaybill"]],
  ["docketDate",            ["docket date"]],
  ["fromWarehouseLocation", ["from warehouse location", "from warehouse"]],
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
  "Expected Delivery Date": "expectedDeliveryDate",
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
  "S.no": "sr",
  "LOT Received date": "lotReceivedDate",
  "Product": "partNo",
  "Engineer Name": "engineerName",
  "Condition (Working/Non Working)": "condition",
  "Storage Status": "storageStatus",
  "Shipping Date": "shippingDate",
  "Asset Remarks": "assetRemarks",
  "RACK NO": "rackNo",
  "Dev IT Inward Lot No": "devItInwardLotNo",
  "HP Lot Number": "hpLotNumber",
  "Previous Image Date": "previousImageDate",
  "Latest Shipped Date (Provision Image)": "latestShippedDate",
  "Latest Courier Name": "latestCourierName",
  "Latest Docket No": "latestDocketNumber",
  "Latest Tracking Status": "latestTrackingStatus",
  "Latest Eway Bill": "latestEwayBill",
  "Latest Delivery Date": "latestDeliveryDate",
  "Latest DC": "latestDc",
  "Latest Employee Name": "employeeName",
  "Master Provision Status-1 NEW": "processStatus",
  "Inward Date - 1": "inwardDate1",
  "Outward Date - 1": "outwardDate1",
  "Inward Date - 2": "inwardDate2",
  "Outward Date - 2": "outwardDate2",
  "Inward Date - 3": "inwardDate3",
  "Outward Date - 3": "outwardDate3",
  "Inward Date - 4": "inwardDate4",
  "Outward Date - 4": "outwardDate4",
  "Inward Date - 5": "inwardDate5",
  "Outward Date - 5": "outwardDate5",
  "Inward Date - 6": "inwardDate6",
  "Outward Date - 6": "outwardDate6",
  // Assignment file fields
  "Req Date to DEV IT": "reqDateToDevIt",
  "Delivery TAT (Date)": "deliveryTatDate",
  "Eway Bill": "ewayBill",
  "Docket Date": "docketDate",
  "From Warehouse Location": "fromWarehouseLocation",
};

const aliases: Record<string, string> = {
  "serial no": "serialNumber",
  "serial no.": "serialNumber",
  "serial number": "serialNumber",
  "s no": "sr",
  "s.no": "sr",
  "serialno": "serialNumber",
  "s/n": "serialNumber",
  "employee name": "employeeName",
  "name of the employee": "employeeName",
  "emp name": "employeeName",
  "lot received": "lotReceivedDate",
  "engineer name": "engineerName",
  "product": "partNo",
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
  "lot received date": "lotReceivedDate",
  "master provision status 1": "processStatus",
  "provision status 1": "processStatus",
  "master provision sub status": "trackingSubStatus",
  "provisioned sub status": "trackingSubStatus",
  "current warehouse location": "invoicingWarehouse",
  "warehouse location": "invoicingWarehouse",
  "asset remarks": "assetRemarks",
  "remarks": "remark",
  "pwc image": "imageType",
  "shipping date": "shippingDate",
  "storage status": "storageStatus",
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
  "expected delivery date": "expectedDeliveryDate",
  "expected delivery": "expectedDeliveryDate",
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
  "latest employee name": "employeeName",
  "engineer": "engineerName",
  "condition": "condition",
  "condition working non working": "condition",
  "working non working": "condition",
  "rack no": "rackNo",
  "rack": "rackNo",
  "dev it inward lot no": "devItInwardLotNo",
  "dev it inward lot": "devItInwardLotNo",
  "inward lot no": "devItInwardLotNo",
  "hp lot number": "hpLotNumber",
  "hp lot no": "hpLotNumber",
  "hp lot": "hpLotNumber",
  "previous image date": "previousImageDate",
  "previous image": "previousImageDate",
  "latest shipped date provision image": "latestShippedDate",
  "latest shipped date": "latestShippedDate",
  "latest shipped": "latestShippedDate",
  "provision image": "latestShippedDate",
  "latest courier name": "latestCourierName",
  "latest courier": "latestCourierName",
  "latest docket no": "latestDocketNumber",
  "latest docket number": "latestDocketNumber",
  "latest docket": "latestDocketNumber",
  "latest tracking status": "latestTrackingStatus",
  "latest tracking": "latestTrackingStatus",
  "latest eway bill": "latestEwayBill",
  "latest e way bill": "latestEwayBill",
  "latest eway": "latestEwayBill",
  "latest delivery date": "latestDeliveryDate",
  "latest delivery": "latestDeliveryDate",
  "latest dc": "latestDc",
  "latest dc no": "latestDc",
  "master provision status 1 new": "processStatus",
  "confirmation display": "checkField",
  "inward date 1": "inwardDate1",
  "inward date - 1": "inwardDate1",
  "outward date 1": "outwardDate1",
  "outward date - 1": "outwardDate1",
  "inward date 2": "inwardDate2",
  "inward date - 2": "inwardDate2",
  "outward date 2": "outwardDate2",
  "outward date - 2": "outwardDate2",
  "inward date 3": "inwardDate3",
  "inward date - 3": "inwardDate3",
  "outward date 3": "outwardDate3",
  "outward date - 3": "outwardDate3",
  "inward date 4": "inwardDate4",
  "inward date - 4": "inwardDate4",
  "outward date 4": "outwardDate4",
  "outward date - 4": "outwardDate4",
  "inward date 5": "inwardDate5",
  "inward date - 5": "inwardDate5",
  "outward date 5": "outwardDate5",
  "outward date - 5": "outwardDate5",
  "inward date 6": "inwardDate6",
  "inward date - 6": "inwardDate6",
  "outward date 6": "outwardDate6",
  "outward date - 6": "outwardDate6",
  // Assignment file aliases
  "req date to dev it": "reqDateToDevIt",
  "req date dev it": "reqDateToDevIt",
  "delivery tat date": "deliveryTatDate",
  "tat date": "deliveryTatDate",
  "eway bill": "ewayBill",
  "e way bill": "ewayBill",
  "ewaybill": "ewayBill",
  "docket date": "docketDate",
  "from warehouse location": "fromWarehouseLocation",
  "from warehouse": "fromWarehouseLocation",
};

const normLookup: Record<string, string> = {};
for (const [raw, col] of Object.entries(baseMapping)) {
  normLookup[normalize(raw)] = col;
}
for (const [alias, col] of Object.entries(aliases)) {
  normLookup[normalize(alias)] = col;
}

// Resolve headers to fields, handling duplicate headers. The provisioning report has
// "Courier Name" twice: the first occurrence is the original courier (vendor), the second
// is the latest courier (latestCourierName). Any other duplicate column keeps its first
// assignment.
// Two passes: EXACT header matches (normLookup) are assigned before fuzzy/keyword matches,
// so a canonical header like "Invoicing Warehouse" or "Image type" wins over a vague one
// like "From Warehouse Location" or "Type" that only matches by keyword overlap.
function resolveColumns(headers: string[]): Map<number, string> {
  const resolvedMap = new Map<number, string>();
  const used = new Set<string>();
  const candidates: { index: number; column: string; exact: boolean; header: string }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const header = (headers[i] ?? "").trim();
    const column = intelligentResolve(header);
    if (!column) continue;
    candidates.push({ index: i, column, exact: !!normLookup[normalize(header)], header });
  }

  const assign = (c: { index: number; column: string; header: string }): void => {
    if (used.has(c.column)) {
      if (c.column === "vendor" && normalize(c.header) === "courier name") {
        c.column = "latestCourierName";
      } else {
        return;
      }
    }
    if (used.has(c.column)) return;
    used.add(c.column);
    resolvedMap.set(c.index, c.column);
  };

  for (const c of candidates) if (c.exact) assign(c);
  for (const c of candidates) if (!c.exact) assign(c);
  return resolvedMap;
}

const dateFields = new Set([
  "requestDate",
  "slaStartDate",
  "expectedDeliveryDate",
  "actualDeliveryDate",
  "laptopAcceptanceDate",
  "warrantyEndPeriod",
  "deliveryDate",
  "pickupDate",
  "dateOfWs1Update",
  "servicesStartDate",
  "date",
  "lotReceivedDate",
  "shippingDate",
  "previousImageDate",
  "latestShippedDate",
  "latestDeliveryDate",
  "inwardDate1",
  "outwardDate1",
  "inwardDate2",
  "outwardDate2",
  "inwardDate3",
  "outwardDate3",
  "inwardDate4",
  "outwardDate4",
  "inwardDate5",
  "outwardDate5",
  "inwardDate6",
  "outwardDate6",
  "reqDateToDevIt",
  "deliveryTatDate",
  "docketDate",
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

// The provisioning file carries the real business state in "Master Provision Status-1 NEW"
// (processStatus). Derive the system `status` from it so dashboard counts match reality:
// - Lost devices → DEFECTIVE
// - Deployed (shipped / redeployed / reallocated) or has a user → ALLOCATED
// - Returned to warehouse → AVAILABLE (physical stock)
// - Registered to an entity → AVAILABLE
// - Otherwise (no entity, not deployed) → NEW
function deriveStatus(
  processStatus: string | null | undefined,
  hasEmployee: boolean,
  hasEntity: boolean
): string {
  const v = (processStatus ?? "").toLowerCase();
  if (v.includes("lost")) return "DEFECTIVE";
  if (
    v.includes("shipped to the user") ||
    v.includes("shipped to user") ||
    v.includes("redeploy") ||
    v.includes("reallocat") ||
    hasEmployee
  ) {
    return "ALLOCATED";
  }
  if (v.includes("return to warehouse") || v.includes("returned to warehouse")) {
    return "AVAILABLE";
  }
  return hasEntity ? "AVAILABLE" : "NEW";
}

function excelSerialToDate(serial: number): Date {
  // Excel epoch: serial 1 = Jan 1, 1900. Lotus 1-2-3 bug: 1900 considered leap year.
  // Returns UTC midnight. Prisma stores @db.Date using the UTC date-part, so this
  // keeps the date exact regardless of server timezone.
  return new Date((serial - 25569) * 86400000);
}

const MONTH_NAMES: Record<string, number> = {};
[
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
].forEach((m, i) => { MONTH_NAMES[m] = i; });

// Parse dates in many common formats. The source data is day-first (DD/MM/YYYY),
// so ambiguous numeric dates are interpreted as day-first to avoid losing values.
// All dates are built with Date.UTC so the stored date is exact (see excelSerialToDate).
function parseFlexibleDate(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;

  // 1. Numeric dd/mm/yyyy, d/m/yy, also handles "23-05-2026", "23.05.2026"
  const numeric = v.match(/^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2,4})$/);
  if (numeric) {
    let d = parseInt(numeric[1], 10);
    let mo = parseInt(numeric[2], 10);
    let y = parseInt(numeric[3], 10);
    if (y < 100) y += 2000;
    // Day-first assumption: if second number is > 12 it must be the day, so swap
    if (mo > 12 && d <= 12) {
      const t = d;
      d = mo;
      mo = t;
    }
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === mo - 1 &&
      dt.getUTCDate() === d &&
      y >= 1900
    ) {
      return dt;
    }
  }

  // 2. ISO date "2026-05-23" or datetime "2026-05-23T00:00:00Z"
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const mo = parseInt(iso[2], 10);
    const d = parseInt(iso[3], 10);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d && y >= 1900) {
      return dt;
    }
  }

  // 3. "23 May 2026", "23-May-2026", "23/May/2026"
  const textual = v.match(/^(\d{1,2})[/\-. ]\s*([A-Za-z]{3,9})[/\-. ]\s*(\d{2,4})$/);
  if (textual) {
    const d = parseInt(textual[1], 10);
    const mon = MONTH_NAMES[textual[2].toLowerCase().slice(0, 3)];
    let y = parseInt(textual[3], 10);
    if (y < 100) y += 2000;
    if (mon !== undefined) {
      const dt = new Date(Date.UTC(y, mon, d));
      if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mon && dt.getUTCDate() === d) return dt;
    }
  }

  // 4. "May 23, 2026", "May-23-2026"
  const textual2 = v.match(/^([A-Za-z]{3,9})[/\-. ]\s*(\d{1,2})[/\-,.]?\s*(\d{2,4})$/);
  if (textual2) {
    const mon = MONTH_NAMES[textual2[1].toLowerCase().slice(0, 3)];
    const d = parseInt(textual2[2], 10);
    let y = parseInt(textual2[3], 10);
    if (y < 100) y += 2000;
    if (mon !== undefined) {
      const dt = new Date(Date.UTC(y, mon, d));
      if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mon && dt.getUTCDate() === d) return dt;
    }
  }

  return null;
}

function parseValue(value: string, field: string): unknown {
  if (value === "" || value === undefined || value === null) return null;
  if (dateFields.has(field)) {
    const num = Number(value);
    if (!isNaN(num) && num > 30000 && num < 60000 && String(Math.round(num)) === value.trim()) {
      return excelSerialToDate(num);
    }
    return parseFlexibleDate(value);
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

interface ParsedSheet {
  name: string;
  headers: string[];
  records: string[][];
}

async function parseFile(file: File): Promise<ParsedSheet[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    const text = await file.text();
    const parsed = parse(text, { skip_empty_lines: true }) as string[][];
    if (parsed.length < 2) {
      throw new Error("File must have a header row and at least one data row.");
    }
    return [{ name: "Sheet1", headers: parsed[0], records: parsed.slice(1) }];
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheets: ParsedSheet[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        sheets.push({ name: sheetName, headers: [], records: [] });
        continue;
      }
      const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
      if (json.length < 2) {
        sheets.push({ name: sheetName, headers: [], records: [] });
        continue;
      }
      const headers = (json[0] as string[]).map(h => String(h ?? ""));
      const records = json.slice(1).map((row: any) =>
        (row as any[]).map((cell: any) => cell?.toString() ?? "")
      );
      sheets.push({ name: sheetName, headers, records });
      // Free memory for this sheet as soon as it is converted
      delete workbook.Sheets[sheetName];
    }
    return sheets;
  }

  throw new Error("Unsupported file format. Please upload a .csv or .xlsx file.");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Postgres has a limit of 65535 bind parameters per statement.
// Chunk the IN(...) query so huge files never exceed it.
const IN_CHUNK_SIZE = 500;

async function findItemsBySerial(
  serials: string[],
  select: Record<string, boolean>
): Promise<Map<string, any>> {
  const unique = [...new Set(serials.map(s => s.trim()).filter(Boolean))];
  const result = new Map<string, any>();
  for (const part of chunk(unique, IN_CHUNK_SIZE)) {
    if (part.length === 0) continue;
    const found = await (prisma.inventoryItem.findMany as any)({
      where: { serialNumber: { in: part } },
      select,
    });
    for (const f of found) {
      result.set(f.serialNumber, f);
    }
  }
  return result;
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

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json(
      { success: false, error: "File exceeds the 20 MB limit." },
      { status: 413 }
    );
  }

  let sheets: ParsedSheet[];
  try {
    sheets = await parseFile(file);
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to parse file." },
      { status: 400 }
    );
  }

  if (sheets.length === 0) {
    return NextResponse.json(
      { success: false, error: "File contains no sheets." },
      { status: 400 }
    );
  }

  const dataSheets = sheets.filter(s => s.headers.length > 0 && s.records.length > 0);
  if (dataSheets.length === 0) {
    return NextResponse.json(
      { success: false, error: "File must have a header row and at least one data row." },
      { status: 400 }
    );
  }

  // ── PREVIEW MODE: return column mapping without touching the database ──
  if (mode === "preview") {
    const first = dataSheets[0];
    const sample = first.records[0] ?? [];
    const resolvedMap = resolveColumns(first.headers);
    const unknownHeaders: string[] = [];
    const seenUnknown = new Set<string>();
    for (const sheet of dataSheets) {
      for (const h of sheet.headers) {
        if (!intelligentResolve(h.trim())) {
          const trimmed = h.trim();
          if (!seenUnknown.has(trimmed)) {
            seenUnknown.add(trimmed);
            unknownHeaders.push(trimmed);
          }
        }
      }
    }
    return NextResponse.json({
      success: true,
      preview: true,
      sheets: sheets.map(s => ({
        name: s.name,
        headerCount: s.headers.length,
        rowCount: s.records.length,
      })),
      rowCount: first.records.length,
      mapping: first.headers.map((h, i) => ({
        header: h.trim(),
        field: resolvedMap.get(i) ?? null,
        sample: (sample[i] ?? "").trim(),
      })),
      unknown: unknownHeaders,
    });
  }

  // ── REAL IMPORT / UPDATE MODE ──
  const total = {
    created: 0,
    updated: 0,
    mapped: 0,
    notFound: 0,
  };
  const errors: string[] = [];
  const matchedHeaders: { header: string; field: string }[] = [];
  let matchedSet = false;

  const revalidateDone = false;

  for (const sheet of dataSheets) {
    const prefix = dataSheets.length > 1 ? `[${sheet.name}] ` : "";

    // Resolve all headers upfront — intelligently
    const resolvedMap = resolveColumns(sheet.headers);
    const sheetMapping: { header: string; field: string | undefined }[] = [];
    const unknownHeaders: string[] = [];

    for (let i = 0; i < sheet.headers.length; i++) {
      const header = sheet.headers[i].trim();
      const column = resolvedMap.get(i);
      if (column) {
        sheetMapping.push({ header, field: column });
      } else {
        unknownHeaders.push(header);
        sheetMapping.push({ header, field: undefined });
      }
    }

    if (!matchedSet) {
      matchedSet = true;
      for (const m of sheetMapping) {
        if (m.field) matchedHeaders.push({ header: m.header, field: m.field });
      }
    }

    if (unknownHeaders.length > 0) {
      errors.push(`${prefix}Unrecognized columns ignored: ${[...new Set(unknownHeaders)].join(", ")}`);
    }

    // Build rows
    const rows: { data: Record<string, unknown>; rowNum: number }[] = [];
    for (let r = 0; r < sheet.records.length; r++) {
      const row = sheet.records[r];
      if (row.length === 0 || row.every(c => c.trim() === "")) continue;

      const data = buildPrismaData(sheet.headers, row, unknownHeaders, resolvedMap);

      if (!data.serialNumber || String(data.serialNumber).trim() === "") {
        errors.push(`${prefix}Row ${r + 2}: No serial number found, skipped`);
        continue;
      }

      if (!data.model && data.laptopModel) {
        data.model = data.laptopModel;
      }

      rows.push({ data, rowNum: r + 2 });
    }

    if (rows.length === 0) {
      errors.push(`${prefix}No valid data rows found.`);
      continue;
    }

    // Coerce the free-text ODA column to a strict Yes/No before it is written.
    for (const row of rows) {
      if (row.data.odaLocation !== undefined && row.data.odaLocation !== null) {
        row.data.odaLocation = normalizeOdaLocation(String(row.data.odaLocation));
      }
    }

    // ── PRODUCT MASTER ENRICHMENT ──
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

    let sheetResult;
    if (mode === "update") {
      sheetResult = await handleUpdateMode(rows, prefix, errors);
    } else {
      sheetResult = await handleUploadMode(rows, prefix, errors);
    }

    total.created += sheetResult.created;
    total.updated += sheetResult.updated;
    total.mapped += sheetResult.mapped;
    total.notFound += sheetResult.notFound;

    // Release memory for this sheet before moving to the next
    sheet.records.length = 0;
  }

  if (!revalidateDone) {
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard");
  }

  const uniqueUnknown = errors.filter(e => e.includes("Unrecognized columns"));
  const warning = uniqueUnknown.length > 0 ? uniqueUnknown.join(" | ") : null;

  return NextResponse.json({
    success: true,
    ...total,
    matched: matchedHeaders,
    errors: errors.length > 0 ? errors : null,
    warning,
  });
}

const BATCH_SIZE = 50;
const TRANSACTION_TIMEOUT_MS = 60000;

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
  "expectedDeliveryDate", "actualDeliveryDate", "slaStatus", "laptopAcceptanceDate", "warrantyPeriod",
  "warrantyEndPeriod", "adaptorAdded", "accessoryHeadsetMouse", "stickerColour",
  "dc", "vendor", "deliveredLocation", "processStatus", "machineWs1Status",
  "serialNoInWs1", "dateOfWs1Update", "servicesStartDate", "invoicingWarehouse",
  "boxSerialNo", "checkField", "remark", "date", "csvStatus",
  "model", "specs", "invoicedQuantity", "customerInstructionDoc", "pickupDate",
  "engineerName", "condition", "storageStatus", "rackNo",
  "devItInwardLotNo", "hpLotNumber", "lotReceivedDate", "shippingDate", "assetRemarks",
  "previousImageDate", "latestShippedDate", "latestCourierName",
  "latestDocketNumber", "latestTrackingStatus", "latestEwayBill",
  "latestDeliveryDate", "latestDc",
  "inwardDate1", "outwardDate1", "inwardDate2", "outwardDate2",
  "inwardDate3", "outwardDate3", "inwardDate4", "outwardDate4",
  "inwardDate5", "outwardDate5", "inwardDate6", "outwardDate6",
  "reqDateToDevIt", "deliveryTatDate",
  "ewayBill", "docketDate", "fromWarehouseLocation",
];

const historySelect = {
  id: true, serialNumber: true,
  employeeName: true, emailId: true, mobileNumber: true, alternatePhoneNumber: true,
  shippingAddress: true, landMark: true, city: true, state: true, pinCode: true,
  purpose: true, requestDate: true, userBaseLocation: true, imageType: true,
  count: true, pwcRemarks: true, trackingStatus: true, trackingSubStatus: true,
  dcNumber: true, docketNumber: true, deliveryDate: true,
} as const;

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
    if (f in data && data[f] !== undefined && data[f] !== null && String(data[f]).trim() !== "") {
      updateData[f] = data[f];
    }
  }
  const hasEmployee = !!data.employeeName && String(data.employeeName).trim() !== "";
  const hasEntity = !!data.entity && String(data.entity).trim() !== "";
  updateData.status = deriveStatus(data.processStatus as string, hasEmployee, hasEntity);
  return updateData;
}

async function handleUpdateMode(
  rows: { data: Record<string, unknown>; rowNum: number }[],
  prefix: string,
  errors: string[]
): Promise<{ created: number; updated: number; mapped: number; notFound: number }> {
  const allSerials = [...new Set(
    rows.map(r => String(r.data.serialNumber ?? "").trim()).filter(Boolean)
  )];

  const existingItems = await findItemsBySerial(allSerials, historySelect);
  const existingMap = new Map(existingItems);

  const historyRecords: Record<string, unknown>[] = [];
  const updateOps: { id: string; data: Record<string, unknown> }[] = [];
  let notFound = 0;

  for (const item of rows) {
    const sn = String(item.data.serialNumber ?? "").trim();
    const existing = existingMap.get(sn);

    if (!existing) {
      notFound++;
      errors.push(`${prefix}Row ${item.rowNum}: Serial number "${sn}" not found in inventory`);
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
      errors.push(`${prefix}Failed to save assignment history batch`);
    }
  }

  // Batch update inventory items using transaction
  let updated = 0;
  for (const batch of chunk(updateOps, BATCH_SIZE)) {
    try {
      await prisma.$transaction(
        batch.map(op => prisma.inventoryItem.update({ where: { id: op.id }, data: op.data as any })),
        { timeout: TRANSACTION_TIMEOUT_MS }
      );
      updated += batch.length;
    } catch (err: any) {
      errors.push(`${prefix}Failed to update inventory batch`);
    }
  }

  return { created: 0, updated, mapped, notFound };
}

async function handleUploadMode(
  rows: { data: Record<string, unknown>; rowNum: number }[],
  prefix: string,
  errors: string[]
): Promise<{ created: number; updated: number; mapped: number; notFound: number }> {
  const allSerials = [...new Set(
    rows.map(r => String(r.data.serialNumber ?? "").trim()).filter(Boolean)
  )];

  const existingItems = await findItemsBySerial(allSerials, { id: true, serialNumber: true });
  const existingMap = new Map(existingItems);

  // Assignment files only update existing inventory items. Serial numbers not found
  // in inventory are skipped and reported — never auto-created.
  const existingRows: { data: Record<string, unknown>; rowNum: number; itemId: string }[] = [];
  let notFound = 0;
  const seenNotFound = new Set<string>();

  for (const item of rows) {
    const sn = String(item.data.serialNumber ?? "").trim();
    const itemId = existingMap.get(sn);
    if (itemId) {
      existingRows.push({ ...item, itemId: String(itemId.id) });
    } else {
      notFound++;
      if (!seenNotFound.has(sn)) {
        seenNotFound.add(sn);
        errors.push(`${prefix}Row ${item.rowNum}: Serial number "${sn}" not found in inventory — skipped`);
      }
    }
  }

  // Batch update existing inventory items with CSV data
  const updateOps: { id: string; data: Record<string, unknown> }[] = [];
  const seenUpdateSerials = new Set<string>();
  for (const item of existingRows) {
    const sn = String(item.data.serialNumber ?? "").trim();
    if (seenUpdateSerials.has(sn)) continue;
    seenUpdateSerials.add(sn);
    const updateData = buildUpdateData(item.data);
    if (Object.keys(updateData).length > 0) {
      updateOps.push({ id: item.itemId, data: updateData });
    }
  }
  let updated = 0;
  for (const batch of chunk(updateOps, BATCH_SIZE)) {
    try {
      await prisma.$transaction(
        batch.map(op => prisma.inventoryItem.update({ where: { id: op.id }, data: op.data as any })),
        { timeout: TRANSACTION_TIMEOUT_MS }
      );
      updated += batch.length;
    } catch (err: any) {
      errors.push(`${prefix}Failed to update existing inventory batch`);
    }
  }

  // Build assignment records for all existing rows (including duplicate serials)
  const allAssignments: Record<string, unknown>[] = [];
  for (const item of existingRows) {
    allAssignments.push(buildAssignmentRecord(item.itemId, item.data));
  }

  // Batch insert all assignment records
  let mapped = 0;
  for (const batch of chunk(allAssignments, BATCH_SIZE)) {
    try {
      const result = await prisma.assignmentRecord.createMany({ data: batch as any[] });
      mapped += result.count;
    } catch (err: any) {
      errors.push(`${prefix}Failed to save assignment history batch`);
    }
  }

  return { created: 0, updated, mapped, notFound };
}
