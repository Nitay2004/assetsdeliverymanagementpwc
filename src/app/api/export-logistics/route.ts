import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";
import { ORDER_PIPELINE_STATUSES } from "@/lib/order-status";

const STATUS_FILTER = ORDER_PIPELINE_STATUSES;

const STATUS_MAP: Record<string, string> = {
  ALLOCATED: "Allocated",
  IN_PROVISIONING: "In Provisioning",
  DOCKET_REQUESTED: "Docket Requested",
  DOCKET_ASSIGNED: "Docket Assigned",
  DC_REQUESTED: "DC Requested",
  DC_GENERATED: "DC Generated",
  EWAY_BILL_REQUESTED: "E-Way Bill Requested",
  EWAY_BILL_GENERATED: "E-Way Bill Generated",
  PACKED_AND_LABELLED: "Packed & Labelled",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  RTO: "RTO",
  RTO_DC_REQUESTED: "RTO DC Requested",
  RTO_DC_GENERATED: "RTO DC Generated",
  RTO_EWAY_BILL_REQUESTED: "RTO E-Way Bill Requested",
  RTO_EWAY_BILL_GENERATED: "RTO E-Way Bill Generated",
  RTO_IN_TRANSIT: "RTO In Transit",
  RTO_DELIVERED_TO_WAREHOUSE: "RTO Delivered to Warehouse",
  DELIVERY_CONFIRMED: "Delivery Confirmed",
  INVOICED: "Invoiced",
  WARRANTY_UPDATED: "Warranty Updated",
  CANCELLED: "Cancelled",
};

function getVal(obj: Record<string, unknown>, field: string): unknown {
  const val = obj[field];
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    return val.toISOString().split("T")[0];
  }
  if (typeof val === "object" && "toString" in val) {
    return String((val as { toString(): string }).toString());
  }
  return String(val);
}

export async function GET() {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "LOGISTICS")) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const [orders, rpDocketRequests] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: STATUS_FILTER as any[] } },
      include: {
        assets: { include: { inventoryItem: true } },
        dockets: { orderBy: { createdAt: "desc" } },
        deliveryChallans: { orderBy: { createdAt: "desc" }, take: 1 },
        rtoRecords: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.reversePickupRequest.findMany({
      where: { status: { in: ["DOCKET_REQUESTED", "DOCKET_ASSIGNED"] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Sheet 1: Logistics Orders
  const orderRows = orders.map((order) => {
    const row: Record<string, unknown> = {
      "Client Name": order.clientName,
      "Intermediary": order.intermediary,
      "Delivery Location": order.deliveryLocation,
      "Total Quantity": order.totalQuantity,
      "Status": STATUS_MAP[order.status] ?? order.status,
      "DC Number": order.dcNumber ?? "",
      "Invoice Number": order.invoiceNumber ?? "",
      "Warehouse Location": order.warehouseLocation ?? "",
      "Provisioning Location": order.provisioningLocation ?? "",
      "Engineer Name": order.engineerName ?? "",
      "Serial Numbers": order.assets
        .filter((a) => a.inventoryItem)
        .map((a) => a.inventoryItem!.serialNumber)
        .join(", "),
      "Allocated Units": order.assets.filter((a) => a.inventoryItemId !== null).length,
      "Docket Numbers": order.dockets.map((d) => d.docketNumber).filter(Boolean).join(", "),
      "E-Way Bill Numbers": order.dockets.map((d) => d.ewayBillNumber).filter(Boolean).join(", "),
      "Has POD": order.dockets.some((d) => d.podDocumentUrl) ? "Yes" : "No",
      "RTO Docket": order.rtoRecords.map((r) => r.rtoDocketNumber).filter(Boolean).join(", "),
      "RTO Date": order.rtoRecords.map((r) => r.rtoDate ? getVal(r as unknown as Record<string, unknown>, "rtoDate") : "").filter(Boolean).join(", "),
      "Created At": getVal(order as unknown as Record<string, unknown>, "createdAt"),
      "Updated At": getVal(order as unknown as Record<string, unknown>, "updatedAt"),
    };
    return row;
  });

  // Sheet 2: Docket Details
  const docketRows: Record<string, unknown>[] = [];
  for (const order of orders) {
    for (const docket of order.dockets) {
      docketRows.push({
        "Client Name": order.clientName,
        "Delivery Location": order.deliveryLocation,
        "Status": STATUS_MAP[order.status] ?? order.status,
        "Docket Number": docket.docketNumber ?? "",
        "E-Way Bill Number": docket.ewayBillNumber ?? "",
        "POD Document URL": docket.podDocumentUrl ?? "",
        "Created At": getVal(docket as unknown as Record<string, unknown>, "createdAt"),
      });
    }
  }

  // Sheet 3: Reverse Pickup Docket Requests
  const rpRows = rpDocketRequests.map((rp) => ({
    "Request Number": rp.requestNumber,
    "Employee Name": rp.employeeName,
    "Serial Number": rp.serialNumber,
    "Model": rp.model,
    "Status": rp.status.replace(/_/g, " "),
    "Warehouse Location": rp.warehouseLocation ?? "",
    "Courier Name": rp.courierName ?? "",
    "Docket Number": rp.docketNumber ?? "",
    "Pickup Address": rp.pickupAddress,
    "City": rp.city ?? "",
    "State": rp.state ?? "",
    "Pin Code": rp.pinCode ?? "",
    "Created At": getVal(rp as unknown as Record<string, unknown>, "createdAt"),
  }));

  const wb = XLSX.utils.book_new();

  const orderSheet = XLSX.utils.json_to_sheet(orderRows);
  XLSX.utils.book_append_sheet(wb, orderSheet, "Logistics Orders");

  if (docketRows.length > 0) {
    const docketSheet = XLSX.utils.json_to_sheet(docketRows);
    XLSX.utils.book_append_sheet(wb, docketSheet, "Docket Details");
  }

  if (rpRows.length > 0) {
    const rpSheet = XLSX.utils.json_to_sheet(rpRows);
    XLSX.utils.book_append_sheet(wb, rpSheet, "Reverse Pickup Dockets");
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="logistics-report-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
