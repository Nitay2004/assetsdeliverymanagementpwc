import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

const itemColumns: { label: string; field: string }[] = [
  // Basic Info
  { label: "Serial Number", field: "serialNumber" },
  { label: "Model", field: "model" },
  { label: "Part No", field: "partNo" },
  { label: "Specs", field: "specs" },
  { label: "Status", field: "status" },
  { label: "Partner", field: "partner" },
  { label: "Sr #", field: "sr" },
  { label: "Entity", field: "entity" },
  { label: "User Base Location", field: "userBaseLocation" },
  { label: "Image Type", field: "imageType" },
  { label: "Purpose", field: "purpose" },
  { label: "Request Date", field: "requestDate" },
  { label: "Count", field: "count" },

  // Employee Info
  { label: "Employee Name", field: "employeeName" },
  { label: "Email ID", field: "emailId" },
  { label: "Mobile Number", field: "mobileNumber" },
  { label: "Alternate Phone", field: "alternatePhoneNumber" },

  // Shipping
  { label: "Shipping Address", field: "shippingAddress" },
  { label: "Land Mark", field: "landMark" },
  { label: "City", field: "city" },
  { label: "State", field: "state" },
  { label: "Pin Code", field: "pinCode" },
  { label: "PwC Remarks", field: "pwcRemarks" },

  // Laptop Info
  { label: "Laptop Make", field: "laptopMake" },
  { label: "Laptop Model", field: "laptopModel" },
  { label: "Invoice Product Description", field: "invoiceProductDescription" },
  { label: "Description", field: "description" },
  { label: "Warranty Period", field: "warrantyPeriod" },
  { label: "Warranty End Period", field: "warrantyEndPeriod" },

  // Timeline & SLA
  { label: "Email Received Hour", field: "emailReceivedHour" },
  { label: "Cut Off Status", field: "cutOffStatus" },
  { label: "SLA Start Date", field: "slaStartDate" },
  { label: "State (SLA)", field: "slaState" },
  { label: "Zone", field: "zone" },
  { label: "Tier", field: "tier" },
  { label: "ODA Location", field: "odaLocation" },
  { label: "TAT", field: "tat" },
  { label: "Delivery TAT (Days)", field: "deliveryTatDays" },
  { label: "Actual Delivery Date", field: "actualDeliveryDate" },
  { label: "SLA Missed/Met", field: "slaStatus" },
  { label: "Laptop Acceptance Date", field: "laptopAcceptanceDate" },

  // Delivery & Tracking
  { label: "Delivery Date", field: "deliveryDate" },
  { label: "DC", field: "dc" },
  { label: "Vendor", field: "vendor" },
  { label: "Delivered Location", field: "deliveredLocation" },
  { label: "Docket Number", field: "docketNumber" },
  { label: "Tracking Status", field: "trackingStatus" },
  { label: "Tracking Sub Status", field: "trackingSubStatus" },
  { label: "Pickup Date", field: "pickupDate" },
  { label: "Process Status", field: "processStatus" },
  { label: "Invoiced Quantity", field: "invoicedQuantity" },
  { label: "Services Start Date", field: "servicesStartDate" },

  // WS1 & Warehouse
  { label: "Machine WS1 Status", field: "machineWs1Status" },
  { label: "Serial No in WS1", field: "serialNoInWs1" },
  { label: "Date of WS1 Update", field: "dateOfWs1Update" },
  { label: "Invoicing Warehouse", field: "invoicingWarehouse" },
  { label: "Box Serial No", field: "boxSerialNo" },

  // Additional
  { label: "Customer Instruction Doc", field: "customerInstructionDoc" },
  { label: "Adaptor Added", field: "adaptorAdded" },
  { label: "Accessory Headset/Mouse", field: "accessoryHeadsetMouse" },
  { label: "Sticker Colour", field: "stickerColour" },
  { label: "Check", field: "checkField" },
  { label: "Remark", field: "remark" },
  { label: "DC Number", field: "dcNumber" },
  { label: "Date", field: "date" },
  { label: "Created At", field: "createdAt" },
  { label: "Updated At", field: "updatedAt" },
];

const assignmentColumns: { label: string; field: string }[] = [
  { label: "Assignment Employee Name", field: "employeeName" },
  { label: "Assignment Email ID", field: "emailId" },
  { label: "Assignment Mobile Number", field: "mobileNumber" },
  { label: "Assignment Alternate Phone", field: "alternatePhoneNumber" },
  { label: "Assignment Shipping Address", field: "shippingAddress" },
  { label: "Assignment Land Mark", field: "landMark" },
  { label: "Assignment City", field: "city" },
  { label: "Assignment State", field: "state" },
  { label: "Assignment Pin Code", field: "pinCode" },
  { label: "Assignment Purpose", field: "purpose" },
  { label: "Assignment Request Date", field: "requestDate" },
  { label: "Assignment User Base Location", field: "userBaseLocation" },
  { label: "Assignment Image Type", field: "imageType" },
  { label: "Assignment Count", field: "count" },
  { label: "Assignment PwC Remarks", field: "pwcRemarks" },
  { label: "Assignment Tracking Status", field: "trackingStatus" },
  { label: "Assignment Tracking Sub Status", field: "trackingSubStatus" },
  { label: "Assignment Date", field: "assignedAt" },
];

function getVal(obj: any, field: string): unknown {
  const val = obj[field];
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    return val.toISOString().split("T")[0];
  }
  return String(val);
}

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Admin access required." },
      { status: 401 }
    );
  }

  const [items, allAssignments] = await Promise.all([
    prisma.inventoryItem.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.assignmentRecord.findMany({
      include: { inventoryItem: { select: { serialNumber: true } } },
      orderBy: { assignedAt: "desc" },
    }),
  ]);

  // Sheet 1: Inventory Items
  const itemRows = items.map(item => {
    const row: Record<string, unknown> = {};
    for (const col of itemColumns) {
      row[col.label] = getVal(item, col.field);
    }
    return row;
  });

  // Sheet 2: Assignment History
  const historyRows = allAssignments.map(record => {
    const row: Record<string, unknown> = { "Serial Number": record.inventoryItem.serialNumber };
    for (const col of assignmentColumns) {
      row[col.label] = getVal(record, col.field);
    }
    return row;
  });

  const wb = XLSX.utils.book_new();

  const itemSheet = XLSX.utils.json_to_sheet(itemRows);
  XLSX.utils.book_append_sheet(wb, itemSheet, "Inventory Items");

  const historySheet = XLSX.utils.json_to_sheet(historyRows);
  XLSX.utils.book_append_sheet(wb, historySheet, "Assignment History");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventory-export-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
