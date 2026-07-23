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
    },
    orderBy: { updatedAt: "desc" },
  });

  const rows: Record<string, unknown>[] = [];
  for (const order of orders) {
    for (const asset of order.assets) {
      rows.push({
        "Client": order.clientName,
        "Engineer": order.engineerName ?? "",
        "WH Location": order.warehouseLocation ?? "",
        "Prov Location": order.provisioningLocation ?? "",
        "Serial No": asset.inventoryItem?.serialNumber ?? "",
        "Model": asset.inventoryItem?.model ?? "",
        "Image Type": asset.inventoryItem?.imageType ?? "",
        "Sticker": asset.inventoryItem?.stickerColour ?? "",
        "Asset Status": ASSET_STATUS_MAP[asset.status] ?? asset.status,
        "Order Status": order.status.replace(/_/g, " "),
        "Created At": getVal(order as unknown as Record<string, unknown>, "createdAt"),
        "Updated At": getVal(order as unknown as Record<string, unknown>, "updatedAt"),
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
