import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

const orderColumns: { label: string; field: string }[] = [
  { label: "Client Name", field: "clientName" },
  { label: "Intermediary", field: "intermediary" },
  { label: "Total Quantity", field: "totalQuantity" },
  { label: "Delivery Location", field: "deliveryLocation" },
  { label: "Status", field: "status" },
  { label: "Warehouse Location", field: "warehouseLocation" },
  { label: "Provisioning Location", field: "provisioningLocation" },
  { label: "Engineer Name", field: "engineerName" },
  { label: "DC Number", field: "dcNumber" },
  { label: "Invoice Number", field: "invoiceNumber" },
  { label: "Created At", field: "createdAt" },
  { label: "Updated At", field: "updatedAt" },
];

const assetColumns: { label: string; field: string }[] = [
  { label: "Asset Status", field: "status" },
  { label: "Serial Number", field: "inventorySerialNumber" },
  { label: "Model", field: "inventoryModel" },
  { label: "Specs", field: "inventorySpecs" },
  { label: "Inventory Status", field: "inventoryStatus" },
  { label: "Image Type", field: "inventoryImageType" },
  { label: "Sticker Colour", field: "inventoryStickerColour" },
  { label: "Employee Name", field: "inventoryEmployeeName" },
  { label: "City", field: "inventoryCity" },
  { label: "State", field: "inventoryState" },
  { label: "Created At", field: "createdAt" },
];

const docketColumns: { label: string; field: string }[] = [
  { label: "Docket Number", field: "docketNumber" },
  { label: "E-Way Bill Number", field: "ewayBillNumber" },
  { label: "POD Document URL", field: "podDocumentUrl" },
  { label: "Created At", field: "createdAt" },
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
  if (!user || (user.role !== "ADMIN" && user.role !== "WAREHOUSE")) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const orders = await prisma.order.findMany({
    include: {
      assets: {
        include: { inventoryItem: true },
      },
      dockets: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const statusMap: Record<string, string> = {
    ORDER_PLACED: "Order Placed",
    ALLOCATED: "Allocated",
    IN_PROVISIONING: "In Provisioning",
    DC_REQUESTED: "DC Requested",
    DC_GENERATED: "DC Generated",
    PACKED_AND_LABELLED: "Packed & Labelled",
    DOCKET_ASSIGNED: "Docket Assigned",
    EWAY_BILL_REQUESTED: "E-way Bill Requested",
    EWAY_BILL_GENERATED: "E-way Bill Generated",
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

  // Sheet 1: Orders
  const orderRows = orders.map((order) => {
    const row: Record<string, unknown> = { "Request Number": order.id.slice(0, 8).toUpperCase() };
    for (const col of orderColumns) {
      const raw = getVal(order as unknown as Record<string, unknown>, col.field);
      row[col.label] = col.field === "status" ? (statusMap[raw as string] ?? raw) : raw;
    }
    const allocated = order.assets.filter((a) => a.inventoryItemId !== null).length;
    row["Allocated Units"] = allocated;
    row["Pending Units"] = order.totalQuantity - allocated;
    return row;
  });

  // Sheet 2: Asset Details
  const assetRows: Record<string, unknown>[] = [];
  for (const order of orders) {
    for (const asset of order.assets) {
      const inv = asset.inventoryItem;
      const row: Record<string, unknown> = {
        "Request Number": order.id.slice(0, 8).toUpperCase(),
        "Client Name": order.clientName,
        "Delivery Location": order.deliveryLocation,
      };
      for (const col of assetColumns) {
        if (col.field.startsWith("inventory")) {
          const invField = col.field.replace("inventory", "");
          const fieldName = invField.charAt(0).toLowerCase() + invField.slice(1);
          row[col.label] = inv ? getVal(inv as unknown as Record<string, unknown>, fieldName) : "";
        } else {
          row[col.label] = getVal(asset as unknown as Record<string, unknown>, col.field);
        }
      }
      assetRows.push(row);
    }
  }

  // Sheet 3: Docket Details
  const docketRows: Record<string, unknown>[] = [];
  for (const order of orders) {
    for (const docket of order.dockets) {
      const row: Record<string, unknown> = {
        "Request Number": order.id.slice(0, 8).toUpperCase(),
        "Client Name": order.clientName,
        "Delivery Location": order.deliveryLocation,
      };
      for (const col of docketColumns) {
        row[col.label] = getVal(docket as unknown as Record<string, unknown>, col.field);
      }
      docketRows.push(row);
    }
  }

  const wb = XLSX.utils.book_new();

  const orderSheet = XLSX.utils.json_to_sheet(orderRows);
  XLSX.utils.book_append_sheet(wb, orderSheet, "Warehouse Orders");

  if (assetRows.length > 0) {
    const assetSheet = XLSX.utils.json_to_sheet(assetRows);
    XLSX.utils.book_append_sheet(wb, assetSheet, "Asset Details");
  }

  if (docketRows.length > 0) {
    const docketSheet = XLSX.utils.json_to_sheet(docketRows);
    XLSX.utils.book_append_sheet(wb, docketSheet, "Docket Details");
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="warehouse-report-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
