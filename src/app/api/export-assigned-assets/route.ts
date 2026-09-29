import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canViewModule } from "@/lib/permissions";
import * as XLSX from "xlsx";

const columns: { label: string; field: string }[] = [
  { label: "Serial Number", field: "serialNumber" },
  { label: "Model", field: "model" },
  { label: "Part No", field: "partNo" },
  { label: "Specs", field: "specs" },
  { label: "Status", field: "status" },
  { label: "Partner", field: "partner" },
  { label: "SR", field: "sr" },
  { label: "Entity", field: "entity" },
  { label: "User Base Location", field: "userBaseLocation" },
  { label: "Image Type", field: "imageType" },
  { label: "Purpose", field: "purpose" },
  { label: "Request Date", field: "requestDate" },
  { label: "Count", field: "count" },
  { label: "Employee Name", field: "employeeName" },
  { label: "Email ID", field: "emailId" },
  { label: "Shipping Address", field: "shippingAddress" },
  { label: "Landmark", field: "landMark" },
  { label: "City", field: "city" },
  { label: "State", field: "state" },
  { label: "Pin Code", field: "pinCode" },
  { label: "Mobile Number", field: "mobileNumber" },
  { label: "Alternate Phone Number", field: "alternatePhoneNumber" },
  { label: "PWC Remarks", field: "pwcRemarks" },
  { label: "Laptop Make", field: "laptopMake" },
  { label: "Laptop Model", field: "laptopModel" },
  { label: "Invoice Product Description", field: "invoiceProductDescription" },
  { label: "Description", field: "description" },
  { label: "Email Received Hour", field: "emailReceivedHour" },
  { label: "Cut Off Status", field: "cutOffStatus" },
  { label: "SLA Start Date", field: "slaStartDate" },
  { label: "SLA State", field: "slaState" },
  { label: "Zone", field: "zone" },
  { label: "Tier", field: "tier" },
  { label: "ODA Location", field: "odaLocation" },
  { label: "TAT", field: "tat" },
  { label: "Delivery TAT Days", field: "deliveryTatDays" },
  { label: "Expected Delivery Date", field: "expectedDeliveryDate" },
  { label: "Actual Delivery Date", field: "actualDeliveryDate" },
  { label: "SLA Status", field: "slaStatus" },
  { label: "Laptop Acceptance Date", field: "laptopAcceptanceDate" },
  { label: "Invoiced Quantity", field: "invoicedQuantity" },
  { label: "Warranty Period", field: "warrantyPeriod" },
  { label: "Warranty End Period", field: "warrantyEndPeriod" },
  { label: "Customer Instruction Doc", field: "customerInstructionDoc" },
  { label: "Adaptor Added", field: "adaptorAdded" },
  { label: "Accessory Headset Mouse", field: "accessoryHeadsetMouse" },
  { label: "Sticker Colour", field: "stickerColour" },
  { label: "Delivery Date", field: "deliveryDate" },
  { label: "DC", field: "dc" },
  { label: "Vendor", field: "vendor" },
  { label: "Delivered Location", field: "deliveredLocation" },
  { label: "Docket Number", field: "docketNumber" },
  { label: "Tracking Status", field: "trackingStatus" },
  { label: "Tracking Sub Status", field: "trackingSubStatus" },
  { label: "Pickup Date", field: "pickupDate" },
  { label: "Process Status", field: "processStatus" },
  { label: "Machine WS1 Status", field: "machineWs1Status" },
  { label: "Serial No In WS1", field: "serialNoInWs1" },
  { label: "Date Of WS1 Update", field: "dateOfWs1Update" },
  { label: "Services Start Date", field: "servicesStartDate" },
  { label: "Invoicing Warehouse", field: "invoicingWarehouse" },
  { label: "Box Serial No", field: "boxSerialNo" },
  { label: "Check Field", field: "checkField" },
  { label: "Remark", field: "remark" },
  { label: "DC Number", field: "dcNumber" },
  { label: "Date", field: "date" },
  { label: "CSV Status", field: "csvStatus" },
  { label: "Created At", field: "createdAt" },
  { label: "Updated At", field: "updatedAt" },
];

function getVal(obj: Record<string, unknown>, field: string): unknown {
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
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }
  if (!canViewModule(user.permissions, user.role, "assigned-assets")) {
    return NextResponse.json(
      { success: false, error: "Forbidden." },
      { status: 403 }
    );
  }

  const items = await prisma.inventoryItem.findMany({
    where: { status: "ALLOCATED" },
    include: {
      assignmentRecords: {
        orderBy: { assignedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const rows = items.map((item) => {
    const latest = item.assignmentRecords[0];
    const data: Record<string, unknown> = { ...item };
    if (latest) {
      data.employeeName = latest.employeeName ?? data.employeeName;
      data.emailId = latest.emailId ?? data.emailId;
      data.mobileNumber = latest.mobileNumber ?? data.mobileNumber;
      data.purpose = latest.purpose ?? data.purpose;
      data.requestDate = latest.requestDate ?? data.requestDate;
      data.userBaseLocation = latest.userBaseLocation ?? data.userBaseLocation;
      data.imageType = latest.imageType ?? data.imageType;
      data.shippingAddress = latest.shippingAddress ?? data.shippingAddress;
      data.landMark = latest.landMark ?? data.landMark;
      data.city = latest.city ?? data.city;
      data.state = latest.state ?? data.state;
      data.pinCode = latest.pinCode ?? data.pinCode;
      data.trackingStatus = latest.trackingStatus ?? data.trackingStatus;
      data.trackingSubStatus = latest.trackingSubStatus ?? data.trackingSubStatus;
      data.docketNumber = latest.docketNumber ?? data.docketNumber;
      data.dcNumber = latest.dcNumber ?? data.dcNumber;
      data.deliveryDate = latest.deliveryDate ?? data.deliveryDate;
    }

    const row: Record<string, unknown> = {};
    for (const col of columns) {
      row[col.label] = getVal(data, col.field);
    }
    return row;
  });

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, "Assigned Assets Report");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="assigned-assets-report-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
