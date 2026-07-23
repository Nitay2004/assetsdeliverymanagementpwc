import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

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

const ASSET_STATUS_MAP: Record<string, string> = {
  pending: "Pending",
  allocated: "Allocated",
  os_installed: "OS Installed",
};

export async function GET() {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "PROVISIONING")) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const orders = await prisma.order.findMany({
    where: { status: { not: "ORDER_PLACED" } },
    include: {
      assets: { include: { inventoryItem: true }, orderBy: { createdAt: "asc" } },
      dockets: { orderBy: { createdAt: "asc" } },
      deliveryChallans: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  let sr = 1;
  const rows: Record<string, unknown>[] = [];
  for (const order of orders) {
    const firstDocket = order.dockets[0];
    const firstDC = order.deliveryChallans[0];
    for (const asset of order.assets) {
      const inv = asset.inventoryItem;
      rows.push({
        "Sr.no": sr++,
        "Inward Date": inv ? getVal(inv as unknown as Record<string, unknown>, "requestDate") : "",
        "Product Part no": inv?.partNo ?? "",
        "Serial No": inv?.serialNumber ?? "",
        "Model": inv?.model ?? "",
        "Product Description": inv?.invoiceProductDescription ?? inv?.description ?? "",
        "Owner of the Asset": inv?.employeeName ?? "",
        "Inward Lot No": inv?.sr?.toString() ?? "",
        "HP Lot No": "",
        "Warehouse Location": order.warehouseLocation ?? "",
        "Provisioning Location": order.provisioningLocation ?? "",
        "Provisioned Date": (asset.status === "os_installed" || asset.status === "allocated")
          ? getVal(order as unknown as Record<string, unknown>, "updatedAt")
          : "",
        "Provisioned Status": ASSET_STATUS_MAP[asset.status] ?? asset.status,
        "Engineer Name": order.engineerName ?? "",
        "Sticker": inv?.stickerColour ?? "",
        "PWC Image": inv?.imageType ?? "",
        "PWC Entity": inv?.entity ?? "",
        "Shipping Date": inv ? getVal(inv as unknown as Record<string, unknown>, "actualDeliveryDate") : "",
        "Courier Name": firstDocket ? "" : "",
        "Docket #": firstDocket?.docketNumber ?? "",
        "Employee Name": inv?.employeeName ?? "",
        "Location - City": inv?.city ?? "",
        "Delivery Date": inv ? getVal(inv as unknown as Record<string, unknown>, "deliveryDate") : "",
        "Warranty Start Date": inv ? getVal(inv as unknown as Record<string, unknown>, "servicesStartDate") : "",
        "Warranty End Date": inv ? getVal(inv as unknown as Record<string, unknown>, "warrantyEndPeriod") : "",
        "Delivery Challans No.": firstDC?.dcNumber ?? order.dcNumber ?? "",
        "Previous Image Date": "",
        "Inward Date - 1": "",
        "Outward Date - 1": "",
        "Inward Date - 2": "",
        "Outward Date - 2": "",
        "Inward Date - 3": "",
        "Outward Date - 3": "",
        "Inward Date - 4": "",
        "HASH ID": inv?.id ?? "",
        "Blancco": "",
        "Blancco DATE": "",
        "Blancco CERTIFICATE": "",
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, "Provisioning Report");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="provisioning-report-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
