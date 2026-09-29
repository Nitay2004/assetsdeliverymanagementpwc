function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

const fieldKeywords: [string, string[]][] = [
  ["serialNumber",     ["serial", "s no", "s.no", "sn", "serial number", "serial no", "serial no."]],
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
  ["model",            ["model", "product", "product name", "machine", "device"]],
  ["specs",            ["spec", "specs", "specification", "configuration", "config"]],
  ["purpose",          ["purpose", "usage", "reason", "why"]],
  ["count",            ["count", "qty", "quantity", "no of", "num", "total"]],
  ["processStatus",    ["process status", "master provision status", "provision status", "master provision", "provisioning status"]],
  ["trackingSubStatus",["tracking sub", "sub status", "sub-status", "provisioned sub status", "sub status"]],
  ["trackingStatus",   ["tracking status", "tracking", "shipment status", "current tracking"]],
  ["csvStatus",        ["status 1", "status_1", "csv status"]],
  ["cutOffStatus",     ["cut off", "cut-off", "cutoff", "cut off status"]],
  ["slaStatus",        ["sla missed", "sla met", "missed met", "miss met", "sla miss", "sla status", "sla missed met"]],
  ["machineWs1Status", ["ws1 status", "ws1", "machine ws1", "workspace one"]],
  ["status",           ["status", "storage status", "storage", "condition", "current status", "asset status"]],
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
  ["userBaseLocation",  ["location", "base location", "provisioning location", "provision location", "work location", "user location", "user base location"]],
  ["deliveredLocation", ["delivered location", "delivery location", "delivered at", "delivery at", "delivered to"]],
  ["invoicingWarehouse",["warehouse", "warehouse location", "invoicing warehouse", "current warehouse", "warehouse loc", "warehouse name"]],
  ["odaLocation",       ["oda", "oda location"]],
  ["zone",              ["zone", "area zone", "region zone"]],
  ["tier",              ["tier", "level", "service tier"]],
  ["tat",               ["tat", "turn around", "turnaround"]],
  ["deliveryTatDays",   ["tat days", "delivery tat", "tat in days", "delivery tat in days"]],
  ["expectedDeliveryDate", ["expected delivery", "exp delivery", "expected delivery date"]],
  ["vendor",            ["vendor", "courier", "courier name", "service provider", "logistics partner", "carrier", "transporter"]],
  ["docketNumber",      ["docket", "docket number", "docket no", "tracking number", "docket #", "docket no.", "awb", "awb number", "consignment"]],
  ["dcNumber",          ["dc number", "dc no", "dc #", "delivery challan", "delivey challan", "challan number", "challan no", "challan"]],
  ["dc",                ["dc"]],
  ["remark",            ["remark", "remarks", "asset remarks", "comments", "notes", "observation"]],
  ["pwcRemarks",        ["pwc remark", "pwc comments", "pwc notes"]],
  ["imageType",         ["image", "pwc image", "image type", "laptop image", "photo"]],
  ["adaptorAdded",      ["adaptor", "adapter", "adaptor added", "adapter added"]],
  ["accessoryHeadsetMouse", ["accessory", "headset", "mouse", "accessory headset", "accessory mouse"]],
  ["stickerColour",     ["sticker", "sticker colour", "sticker color", "sticker col", "sticker shade"]],
  ["checkField",        ["check", "verified", "confirmation", "confirm", "checked"]],
  ["customerInstructionDoc", ["customer instruction", "instruction doc", "customer doc", "instruction"]],
  ["invoicedQuantity",  ["invoiced qty", "invoiced quantity", "invoice qty", "quantity invoiced", "invoiced", "invoice quantity"]],
  ["sr",                ["sr", "sr no", "sequence", "lot no", "inward lot", "lot number", "dev it inward lot", "hp lot", "hp lot number"]],
];

function scoreHeader(headerNorm: string, keywords: string[]): number {
  let best = 0;
  for (const kw of keywords) {
    if (headerNorm === kw) best = Math.max(best, 1000);
    else if (headerNorm.includes(kw)) best = Math.max(best, kw.length * 10);
    else if (kw.includes(headerNorm) && headerNorm.length >= 3) best = Math.max(best, headerNorm.length * 5);
  }
  return best;
}

function intelligentResolve(header: string): string | undefined {
  const n = normalize(header);
  if (!n) return undefined;
  let bestField: string | undefined;
  let bestScore = 0;
  for (const [field, keywords] of fieldKeywords) {
    const score = scoreHeader(n, keywords);
    if (score > bestScore) { bestScore = score; bestField = field; }
  }
  return bestScore >= 20 && bestField ? bestField : undefined;
}

const userHeaders = [
  "S.no", "LOT Received date", "Product", "Serial No", "Model",
  "Owner of the Asset", "Dev IT Inward Lot No", "HP Lot Number",
  "Provisioning Location", "Provisioned Date", "Master Provision Status-1",
  "Provisioned Sub Status", "Asset Remarks", "Current warehouse location",
  "Engineer Name", "PWC Image", "PWCEntity", "Shipping Date",
  "Storage Status", "Courier Name", "Docket #", "Employee Name",
  "Location - City", "CONFIRMATION DISPLAY", "RACK NO", "REMARKS",
  "Delivery Date", "Warranty End Date", "Delivey Challan", "Courier Name",
  "Docket #"
];

console.log("=== Header Matching Results ===\n");
let matched = 0, unmatched = 0;
for (const h of userHeaders) {
  const result = intelligentResolve(h);
  const n = normalize(h);
  if (result) { matched++; } else { unmatched++; }
  console.log(`${result ? "✅" : "❌"} "${h}" → ${result ?? "UNMATCHED"}`);
}
console.log(`\nMatched: ${matched}/${userHeaders.length}`);
