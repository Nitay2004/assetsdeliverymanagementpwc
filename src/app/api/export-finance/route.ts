import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

const STATUS_FILTER = [
  "IN_PROVISIONING", "DC_REQUESTED", "DC_GENERATED", "PACKED_AND_LABELLED",
  "DOCKET_ASSIGNED", "EWAY_BILL_REQUESTED", "EWAY_BILL_GENERATED",
  "DISPATCHED", "DELIVERED", "RTO", "RTO_DC_REQUESTED", "RTO_DC_GENERATED",
  "RTO_EWAY_BILL_REQUESTED", "RTO_EWAY_BILL_GENERATED", "DELIVERY_CONFIRMED",
];

const STATUS_MAP: Record<string, string> = {
  IN_PROVISIONING: "In Provisioning",
  DC_REQUESTED: "DC Requested",
  DC_GENERATED: "DC Generated",
  PACKED_AND_LABELLED: "Packed & Labelled",
  DOCKET_ASSIGNED: "Docket Assigned",
  EWAY_BILL_REQUESTED: "E-Way Bill Requested",
  EWAY_BILL_GENERATED: "E-Way Bill Generated",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  RTO: "RTO",
  RTO_DC_REQUESTED: "RTO DC Requested",
  RTO_DC_GENERATED: "RTO DC Generated",
  RTO_EWAY_BILL_REQUESTED: "RTO E-Way Bill Requested",
  RTO_EWAY_BILL_GENERATED: "RTO E-Way Bill Generated",
  DELIVERY_CONFIRMED: "Delivery Confirmed",
  INVOICED: "Invoiced",
  WARRANTY_UPDATED: "Warranty Updated",
};

const orderColumns: { label: string; field: string }[] = [
  { label: "Client Name", field: "clientName" },
  { label: "Intermediary", field: "intermediary" },
  { label: "Total Quantity", field: "totalQuantity" },
  { label: "Delivery Location", field: "deliveryLocation" },
  { label: "Warehouse Location", field: "warehouseLocation" },
  { label: "Provisioning Location", field: "provisioningLocation" },
  { label: "Engineer Name", field: "engineerName" },
  { label: "DC Number", field: "dcNumber" },
  { label: "Invoice Number", field: "invoiceNumber" },
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
  if (typeof val === "object" && "toString" in val) {
    return String((val as { toString(): string }).toString());
  }
  return String(val);
}

export async function GET() {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "FINANCE")) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const [orders, allDockets, rpRequests] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: STATUS_FILTER as any[] } },
      include: {
        assets: { include: { inventoryItem: true } },
        deliveryChallans: {
          include: { items: true, warehouse: true },
          orderBy: { createdAt: "desc" },
        },
        dockets: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.docket.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.reversePickupRequest.findMany({
      where: { status: { in: ["DC_REQUESTED", "DC_GENERATED", "EWAY_BILL_REQUESTED", "EWAY_BILL_GENERATED"] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Sheet 1: Finance Orders
  const orderRows = orders.map((order) => {
    const row: Record<string, unknown> = {};
    for (const col of orderColumns) {
      const raw = getVal(order as unknown as Record<string, unknown>, col.field);
      row[col.label] = col.field === "status" ? (STATUS_MAP[order.status] ?? order.status) : raw;
    }
    row["Status"] = STATUS_MAP[order.status] ?? order.status;
    row["Serial Numbers"] = order.assets
      .filter((a) => a.inventoryItem)
      .map((a) => a.inventoryItem!.serialNumber)
      .join(", ");
    row["Allocated Units"] = order.assets.filter((a) => a.inventoryItemId !== null).length;
    row["Docket Numbers"] = order.dockets.map((d) => d.docketNumber).filter(Boolean).join(", ");
    row["E-Way Bill Numbers"] = order.dockets.map((d) => d.ewayBillNumber).filter(Boolean).join(", ");
    return row;
  });

  // Sheet 2: Delivery Challans
  const dcRows: Record<string, unknown>[] = [];
  for (const order of orders) {
    for (const dc of order.deliveryChallans) {
      const base: Record<string, unknown> = {
        "Order Client": order.clientName,
        "Order Location": order.deliveryLocation,
        "DC Number": dc.dcNumber,
        "DC Date": getVal(dc as unknown as Record<string, unknown>, "dcDate"),
        "Warehouse": dc.warehouse?.name ?? "",
        "Ship To Location": dc.shipToLocation ?? "",
        "Bill To Location": dc.billToLocation ?? "",
        "Mode of Payment": dc.modeOfPayment ?? "",
        "Reference No": dc.referenceNo ?? "",
        "Reference Date": getVal(dc as unknown as Record<string, unknown>, "referenceDate"),
        "Dispatch Doc No": dc.dispatchDocNo ?? "",
        "Dispatched Through": dc.dispatchedThrough ?? "",
        "Destination": dc.destination ?? "",
        "Terms of Delivery": dc.termsOfDelivery ?? "",
        "Taxable Value": getVal(dc as unknown as Record<string, unknown>, "taxableValue"),
        "IGST": getVal(dc as unknown as Record<string, unknown>, "igst"),
        "Total Tax Amount": getVal(dc as unknown as Record<string, unknown>, "totalTaxAmount"),
      };

      if (dc.items.length > 0) {
        for (const item of dc.items) {
          const row = { ...base };
          row["Item Description"] = item.description;
          row["HSN/SAC"] = item.hsnSac ?? "";
          row["Item Quantity"] = item.quantity;
          row["Item Rate"] = getVal(item as unknown as Record<string, unknown>, "rate");
          row["Item Amount"] = getVal(item as unknown as Record<string, unknown>, "amount");
          dcRows.push(row);
        }
      } else {
        dcRows.push(base);
      }
    }
  }

  // Sheet 3: Docket Details
  const docketOrderMap = new Map(orders.map((o) => [o.id, o]));
  const docketRows = allDockets
    .filter((d) => docketOrderMap.has(d.orderId))
    .map((docket) => {
      const order = docketOrderMap.get(docket.orderId)!;
      return {
        "Client Name": order.clientName,
        "Delivery Location": order.deliveryLocation,
        "Status": STATUS_MAP[order.status] ?? order.status,
        "Docket Number": docket.docketNumber ?? "",
        "E-Way Bill Number": docket.ewayBillNumber ?? "",
        "POD Document URL": docket.podDocumentUrl ?? "",
        "Created At": getVal(docket as unknown as Record<string, unknown>, "createdAt"),
      };
    });

  // Sheet 4: Reverse Pickup Finance
  const rpDcRequests = rpRequests.filter((r) => r.status === "DC_REQUESTED" || r.status === "DC_GENERATED");
  const rpEwayRequests = rpRequests.filter((r) => r.status === "EWAY_BILL_REQUESTED" || r.status === "EWAY_BILL_GENERATED");

  const rpRows = rpRequests.map((rp) => ({
    "Request Number": rp.requestNumber,
    "Employee Name": rp.employeeName,
    "Serial Number": rp.serialNumber,
    "Model": rp.model,
    "Status": rp.status.replace(/_/g, " "),
    "Warehouse Location": rp.warehouseLocation ?? "",
    "Courier Name": rp.courierName ?? "",
    "Docket Number": rp.docketNumber ?? "",
    "E-Way Bill No": rp.eWayBillNo ?? "",
    "DC No": rp.dcNo ?? "",
    "QC Result": rp.qcResult ?? "",
    "Created At": getVal(rp as unknown as Record<string, unknown>, "createdAt"),
  }));

  const wb = XLSX.utils.book_new();

  const orderSheet = XLSX.utils.json_to_sheet(orderRows);
  XLSX.utils.book_append_sheet(wb, orderSheet, "Finance Orders");

  if (dcRows.length > 0) {
    const dcSheet = XLSX.utils.json_to_sheet(dcRows);
    XLSX.utils.book_append_sheet(wb, dcSheet, "Delivery Challans");
  }

  if (docketRows.length > 0) {
    const docketSheet = XLSX.utils.json_to_sheet(docketRows);
    XLSX.utils.book_append_sheet(wb, docketSheet, "Docket Details");
  }

  if (rpRows.length > 0) {
    const rpSheet = XLSX.utils.json_to_sheet(rpRows);
    XLSX.utils.book_append_sheet(wb, rpSheet, "Reverse Pickup Finance");
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="finance-report-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
