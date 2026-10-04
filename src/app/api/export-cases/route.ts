import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

const ORDER_STATUS_LABELS: Record<string, string> = {
  ORDER_PLACED: "Order Placed",
  ALLOCATED: "Allocated",
  IN_PROVISIONING: "In Provisioning",
  DOCKET_REQUESTED: "Docket Requested",
  DOCKET_ASSIGNED: "Docket Assigned",
  DC_REQUESTED: "DC Requested",
  DC_GENERATED: "DC Generated",
  PACKED_AND_LABELLED: "Packed & Labelled",
  EWAY_BILL_REQUESTED: "E-way Bill Requested",
  EWAY_BILL_GENERATED: "E-way Bill Generated",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  RTO: "RTO - Return to Origin",
  RTO_DC_REQUESTED: "RTO DC Requested",
  RTO_DC_GENERATED: "RTO DC Generated",
  RTO_EWAY_BILL_REQUESTED: "RTO E-Way Bill Requested",
  RTO_EWAY_BILL_GENERATED: "RTO E-Way Bill Generated",
  RTO_IN_TRANSIT: "RTO In Transit",
  RTO_DELIVERED_TO_WAREHOUSE: "RTO Delivered to Warehouse",
  DELIVERY_CONFIRMED: "Delivery Confirmed",
  INVOICED: "Invoiced",
  WARRANTY_UPDATED: "Warranty Updated",
};

const REVERSE_STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  PARTNER_ASSIGNED: "Partner Assigned",
  DOCKET_REQUESTED: "Docket Requested",
  INSPECTED: "Inspected",
  PICKED_UP: "Picked Up",
  RECEIVED_AT_WAREHOUSE: "Received at Warehouse",
  QC_CLEANED: "Hardware QC",
  QC_COMPLETED: "Software QC",
  DC_REQUESTED: "DC Requested",
  DC_GENERATED: "DC Generated",
  EWAY_BILL_REQUESTED: "E-way Bill Requested",
  EWAY_BILL_GENERATED: "E-way Bill Generated",
  BLANCO_CLEARED: "Blanco Clear",
  BLANCO_PURGED: "Blanco Purge",
  BLANCO_CERTIFIED: "Blanco Certified",
  COMPLETED: "Completed",
};

const CLOSED_ORDER_STATUSES = ["DELIVERED", "DELIVERY_CONFIRMED", "INVOICED", "WARRANTY_UPDATED"];
const CLOSED_REVERSE_STATUSES = [
  "RECEIVED_AT_WAREHOUSE",
  "QC_CLEANED",
  "QC_COMPLETED",
  "DC_REQUESTED",
  "DC_GENERATED",
  "EWAY_BILL_REQUESTED",
  "EWAY_BILL_GENERATED",
  "BLANCO_CLEARED",
  "BLANCO_PURGED",
  "BLANCO_CERTIFIED",
  "COMPLETED",
];

const COLUMNS = [
  "Case Type",
  "Case Status",
  "Serial Number",
  "Model",
  "Inventory Status",
  "Workflow Status",
  "Employee Name",
  "Email ID",
  "Mobile Number",
  "City",
  "State",
  "Order ID / Request No",
  "DC Number",
  "Docket Number",
  "Invoicing Warehouse",
  "Delivery Date",
  "Case Opened",
  "Case Closed",
  "Case Age (Days)",
];

function dateStr(d: Date | null | undefined): string {
  if (!d) return "";
  const t = d.getTime();
  if (isNaN(t)) return "";
  return d.toISOString().split("T")[0];
}

function daysBetween(a: Date | null | undefined, b: Date | null | undefined): number {
  if (!a || !b) return 0;
  const t1 = a.getTime();
  const t2 = b.getTime();
  if (isNaN(t1) || isNaN(t2)) return 0;
  return Math.max(0, Math.round((t2 - t1) / (1000 * 60 * 60 * 24)));
}

interface CaseRow {
  caseType: string;
  closed: boolean;
  statusKey: string;
  closedDate: Date | null;
  employeeName: string | null;
  emailId: string | null;
  mobileNumber: string | null;
  city: string | null;
  state: string | null;
  referenceNo: string;
  dcNumber: string | null;
  docketNumber: string | null;
  invoicingWarehouse: string | null;
  deliveryDate: Date | null;
  createdAt: Date;
  serialNumber: string;
  model: string;
  inventoryStatus: string;
}

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Admin access required." },
      { status: 401 }
    );
  }

  const items = await prisma.inventoryItem.findMany({
    include: {
      assets: {
        include: { order: { include: { rtoRecords: true } } },
        orderBy: { createdAt: "desc" },
      },
      reversePickupRequests: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: CaseRow[] = [];

  for (const item of items) {
    const order = item.assets[0]?.order ?? null;
    const reverse = item.reversePickupRequests[0] ?? null;
    const delivered = !!(item.deliveryDate || item.actualDeliveryDate);

    let caseType = "";
    let closed = false;
    let statusKey = "";
    let closedDate: Date | null = null;
    let referenceNo = "";

    if (order && order.status.startsWith("RTO")) {
      caseType = "RTO Return";
      referenceNo = order.id;
      statusKey = order.status;
      closed = order.status === "RTO_DELIVERED_TO_WAREHOUSE";
      if (closed) {
        closedDate = order.rtoRecords[0]?.rtoDate ?? order.updatedAt;
      }
    } else if (order) {
      caseType = "Forward Order";
      referenceNo = order.id;
      closed = CLOSED_ORDER_STATUSES.includes(order.status) || delivered;
      if (delivered && !CLOSED_ORDER_STATUSES.includes(order.status)) {
        statusKey = "DELIVERED";
      } else {
        statusKey = order.status;
      }
      if (closed) {
        closedDate = item.deliveryDate ?? item.actualDeliveryDate ?? order.updatedAt;
      }
    } else if (reverse) {
      caseType = "Reverse Pickup";
      referenceNo = reverse.requestNumber;
      statusKey = reverse.status;
      closed = CLOSED_REVERSE_STATUSES.includes(reverse.status);
      if (closed) {
        closedDate = reverse.receivedDate ?? reverse.updatedAt;
      }
    } else if (delivered) {
      caseType = "Forward Delivery";
      statusKey = "DELIVERED";
      closed = true;
      closedDate = item.deliveryDate ?? item.actualDeliveryDate;
    } else {
      continue;
    }

    rows.push({
      caseType,
      closed,
      statusKey,
      closedDate,
      employeeName: item.employeeName,
      emailId: item.emailId,
      mobileNumber: item.mobileNumber,
      city: item.city,
      state: item.state,
      referenceNo,
      dcNumber: item.dcNumber,
      docketNumber: item.docketNumber,
      invoicingWarehouse: item.invoicingWarehouse,
      deliveryDate: item.deliveryDate,
      createdAt: item.createdAt,
      serialNumber: item.serialNumber,
      model: item.model,
      inventoryStatus: item.status,
    });
  }

  const openRows: Record<string, unknown>[] = [];
  const closedRows: Record<string, unknown>[] = [];

  for (const r of rows) {
    const workflowLabel =
      r.caseType === "Reverse Pickup"
        ? REVERSE_STATUS_LABELS[r.statusKey] ?? r.statusKey
        : ORDER_STATUS_LABELS[r.statusKey] ?? r.statusKey;

    const row: Record<string, unknown> = {
      "Case Type": r.caseType,
      "Case Status": r.closed ? "Closed" : "Open",
      "Serial Number": r.serialNumber,
      "Model": r.model,
      "Inventory Status": r.inventoryStatus,
      "Workflow Status": workflowLabel,
      "Employee Name": r.employeeName ?? "",
      "Email ID": r.emailId ?? "",
      "Mobile Number": r.mobileNumber ?? "",
      "City": r.city ?? "",
      "State": r.state ?? "",
      "Order ID / Request No": r.referenceNo,
      "DC Number": r.dcNumber ?? "",
      "Docket Number": r.docketNumber ?? "",
      "Invoicing Warehouse": r.invoicingWarehouse ?? "",
      "Delivery Date": dateStr(r.deliveryDate),
      "Case Opened": dateStr(r.createdAt),
      "Case Closed": r.closed ? dateStr(r.closedDate) : "",
      "Case Age (Days)": r.closed
        ? daysBetween(r.createdAt, r.closedDate)
        : daysBetween(r.createdAt, new Date()),
    };

    if (r.closed) closedRows.push(row);
    else openRows.push(row);
  }

  const wb = XLSX.utils.book_new();

  const openSheet = XLSX.utils.json_to_sheet(openRows, { header: COLUMNS });
  XLSX.utils.book_append_sheet(wb, openSheet, "Open Cases");

  const closedSheet = XLSX.utils.json_to_sheet(closedRows, { header: COLUMNS });
  XLSX.utils.book_append_sheet(wb, closedSheet, "Closed Cases");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cases-report-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
