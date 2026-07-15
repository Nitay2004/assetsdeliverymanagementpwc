import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

const columns: { label: string; field: string }[] = [
  { label: "Request Number", field: "requestNumber" },
  { label: "Status", field: "status" },
  { label: "Year", field: "year" },
  { label: "Type", field: "type" },
  { label: "SR No", field: "srNo" },
  { label: "Request Date (HP)", field: "requestDateHp" },
  { label: "Employee ID", field: "employeeId" },
  { label: "Alternate ID", field: "alternateId" },
  { label: "Last Working Day", field: "lastWorkingDay" },
  { label: "Employee Name", field: "employeeName" },
  { label: "Email ID", field: "emailId" },
  { label: "Mobile Number", field: "mobileNumber" },
  { label: "Contact", field: "contact" },
  { label: "Serial Number", field: "serialNumber" },
  { label: "Model", field: "model" },
  { label: "Entity", field: "entity" },
  { label: "Image Type", field: "imageType" },
  { label: "Accessories", field: "accessories" },
  { label: "Reason", field: "reason" },
  { label: "Pickup Address", field: "pickupAddress" },
  { label: "Landmark", field: "landmark" },
  { label: "City", field: "city" },
  { label: "State", field: "state" },
  { label: "Pin Code", field: "pinCode" },
  { label: "Warehouse Location", field: "warehouseLocation" },
  { label: "Receiver Serial No", field: "receiverSerialNo" },
  { label: "Receiver SN Entity", field: "receiverSnEntity" },
  { label: "Display Status", field: "displayStatus" },
  { label: "ETA", field: "eta" },
  { label: "Future Date Pickup", field: "futureDatePickup" },
  { label: "Dependency", field: "dependency" },
  { label: "Remarks", field: "remarks" },
  { label: "Email Received Hour", field: "emailReceivedHour" },
  { label: "Cut Off Status", field: "cutOffStatus" },
  { label: "SLA Start Date", field: "slaStartDate" },
  { label: "SLA State", field: "slaState" },
  { label: "Zone", field: "zone1" },
  { label: "Tier", field: "tier1" },
  { label: "ODA Location", field: "odaLocation" },
  { label: "TAT", field: "tat" },
  { label: "Delivery TAT", field: "deliveryTat" },
  { label: "Actual Delivery POD Date", field: "actualDeliveryPodDate" },
  { label: "SLA", field: "sla" },
  { label: "Laptop Acceptance Date", field: "laptopAcceptanceDate" },
  { label: "Courier Name", field: "courierName" },
  { label: "Docket Number", field: "docketNumber" },
  { label: "Pickup Date", field: "pickupDate" },
  { label: "DC No", field: "dcNo" },
  { label: "SRN No", field: "srnNo" },
  { label: "E-Way Bill No", field: "eWayBillNo" },
  { label: "ETA Unit Received", field: "etaForUnitReceived" },
  { label: "Case Age", field: "caseAge" },
  { label: "Partner Name", field: "partnerName" },
  { label: "Partner Reference", field: "partnerReference" },
  { label: "Inspection Remarks", field: "inspectionRemarks" },
  { label: "Inspection Date", field: "inspectionDate" },
  { label: "Received Date", field: "receivedDate" },
  { label: "Received By", field: "receivedBy" },
  { label: "QC Remarks", field: "qcRemarks" },
  { label: "QC Date", field: "qcDate" },
  { label: "QC Performed By", field: "qcPerformedBy" },
  { label: "QC Result", field: "qcResult" },
  { label: "Blancco Yes/No", field: "blanccoYesNo" },
  { label: "Blancco Date", field: "blanccoDate" },
  { label: "Blanco Certificate URL", field: "blancoCertificateUrl" },
  { label: "Blanco Certificate Date", field: "blancoCertificateDate" },
  { label: "Case ID", field: "caseId" },
  { label: "Issue Reported", field: "issueReported" },
  { label: "Replacement Part", field: "replacementPart" },
  { label: "Exception Remarks", field: "exceptionRemarks" },
  { label: "Remark", field: "remark" },
  { label: "Final Disposition", field: "finalDisposition" },
  { label: "Created By", field: "createdBy" },
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
  if (!user || (user.role !== "ADMIN" && user.role !== "REVERSE_PICKUP")) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const requests = await prisma.reversePickupRequest.findMany({
    orderBy: { createdAt: "desc" },
  });

  const rows = requests.map((req) => {
    const row: Record<string, unknown> = {};
    for (const col of columns) {
      row[col.label] = getVal(req as unknown as Record<string, unknown>, col.field);
    }
    return row;
  });

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, "Reverse Pickup Report");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reverse-pickup-report-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
