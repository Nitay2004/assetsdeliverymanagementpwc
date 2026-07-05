export const fields: Record<string, { label: string; type: string; required?: boolean }[]> = {
  "Basic Info": [
    { label: "Serial Number", type: "text", required: true },
    { label: "Model", type: "text", required: true },
    { label: "Specs", type: "text" },
    { label: "Status", type: "text" },
    { label: "Partner", type: "text" },
    { label: "Sr #", type: "number" },
    { label: "Entity", type: "text" },
  ],
  "Request Details": [
    { label: "User Base Location", type: "text" },
    { label: "Image Type", type: "text" },
    { label: "Purpose", type: "text" },
    { label: "Request Date", type: "date" },
    { label: "Count", type: "number" },
  ],
  "Employee Info": [
    { label: "Employee Name", type: "text" },
    { label: "Email ID", type: "text" },
    { label: "Mobile Number", type: "text" },
    { label: "Alternate Phone Number", type: "text" },
  ],
  "Shipping": [
    { label: "Shipping Address", type: "text" },
    { label: "Land Mark", type: "text" },
    { label: "City", type: "text" },
    { label: "State", type: "text" },
    { label: "Pin Code", type: "text" },
  ],
  "Laptop Info": [
    { label: "Part No", type: "text" },
    { label: "Laptop Make", type: "text" },
    { label: "Laptop Model", type: "text" },
    { label: "Invoice Product Description", type: "text" },
    { label: "Description", type: "text" },
    { label: "Warranty Period", type: "text" },
    { label: "PwC Remarks", type: "text" },
  ],
  "Timeline & SLA": [
    { label: "Email Received Hour", type: "text" },
    { label: "Cut Off Status", type: "text" },
    { label: "SLA Start Date", type: "date" },
    { label: "State (SLA)", type: "text" },
    { label: "Zone", type: "text" },
    { label: "Tier", type: "text" },
    { label: "ODA Location", type: "text" },
    { label: "TAT", type: "text" },
    { label: "Delivery TAT (Days)", type: "number" },
    { label: "Actual Delivery Date", type: "date" },
    { label: "SLA Missed/Met", type: "text" },
    { label: "Laptop Acceptance Date", type: "date" },
  ],
  "Delivery & Tracking": [
    { label: "Delivery Date", type: "date" },
    { label: "DC", type: "text" },
    { label: "Vendor", type: "text" },
    { label: "Delivered Location", type: "text" },
    { label: "Docket Number", type: "text" },
    { label: "Tracking Status", type: "text" },
    { label: "Tracking Sub Status", type: "text" },
    { label: "Pickup Date", type: "date" },
    { label: "Process Status", type: "text" },
  ],
  "Warranty": [
    { label: "Invoiced Quantity", type: "number" },
    { label: "Warranty Period", type: "text" },
    { label: "Warranty End Period", type: "date" },
    { label: "Services Start Date", type: "date" },
  ],
  "WS1 & Warehouse": [
    { label: "Machine WS1 Status", type: "text" },
    { label: "Serial No in WS1", type: "text" },
    { label: "Date of WS1 Update", type: "date" },
    { label: "Invoicing Warehouse", type: "text" },
    { label: "Box Serial No", type: "text" },
  ],
  "Additional": [
    { label: "Customer Instruction Doc", type: "text" },
    { label: "Adaptor Added", type: "text" },
    { label: "Accessory Headset/Mouse", type: "text" },
    { label: "Sticker Colour", type: "text" },
    { label: "Check", type: "text" },
    { label: "Remark", type: "text" },
    { label: "DC Number", type: "text" },
    { label: "Date", type: "date" },
    { label: "Status_1", type: "text" },
  ],
};

export function toFieldName(label: string): string {
  return label
    .replace(/[#()/]/g, "")
    .replace(/[ _-]+/g, " ")
    .split(" ")
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}
