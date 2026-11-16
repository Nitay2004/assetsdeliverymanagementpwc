import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canViewModule } from "@/lib/permissions";
import { podFileUrl } from "@/lib/storage";
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

// Normalise status string for both Order and InventoryItem
function normaliseStatus(status: string | null | undefined): string {
  if (!status) return "";
  const s = String(status).trim();
  return s;
}

// Safe helper: split a URL string, guard against null/undefined
function splitLastSegment(url: string | null | undefined): string {
  if (!url) return "";
  return url.split("/").pop() ?? "";
}

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }
  if (!canViewModule(user.permissions, user.role, "logistics")) {
    return NextResponse.json(
      { success: false, error: "Forbidden." },
      { status: 403 }
    );
  }

  // Orders with dockets that have POD documents
  const orders = await prisma.order.findMany({
    where: {
      dockets: { some: { podDocumentUrl: { not: null } } },
    },
    include: {
      assets: { include: { inventoryItem: true } },
      dockets: {
        where: { podDocumentUrl: { not: null } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Inventory items that have POD documents (from bulk Excel imports)
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: {
      podDocumentUrl: { not: null },
      assets: { some: {} }, // only items that have an Asset link (materialized)
    },
    orderBy: { createdAt: "desc" },
  });

  // Resolve POD download links for orders' dockets
  const docketPodPromises = orders.flatMap((order) =>
    order.dockets.map((docket) => (docket.podDocumentUrl ? podFileUrl(docket.podDocumentUrl) : Promise.resolve("")))
  );
  const docketPodLinks = await Promise.all(docketPodPromises);

  // Build rows from orders
  const orderRows = await Promise.all(
    orders.flatMap((order, orderIdx) =>
      order.dockets.map((docket, docketIdx) => {
        const podLink = docketPodLinks[orderIdx * order.dockets.length + docketIdx];
        return {
          "Client Name": order.clientName,
          "Delivery Location": order.deliveryLocation,
          "DC Number": order.dcNumber ?? "",
          "Status": normaliseStatus(order.status),
          "Docket Number": docket.docketNumber ?? "",
          "E-Way Bill Number": docket.ewayBillNumber ?? "",
          "POD File": splitLastSegment(docket.podDocumentUrl),
          "POD Download Link (click to download)": podLink,
          "Serial Numbers": order.assets
            .filter((a) => a.inventoryItem)
            .map((a) => a.inventoryItem!.serialNumber)
            .join(", "),
          "Created At": getVal(docket as unknown as Record<string, unknown>, "createdAt"),
        };
      })
    )
  );

  // Resolve POD download links for inventory items
  const itemPodPromises = inventoryItems.map((item) => (item.podDocumentUrl ? podFileUrl(item.podDocumentUrl) : Promise.resolve("")));
  const itemPodLinks = await Promise.all(itemPodPromises);

  // Build rows from inventory items
  const inventoryRows = await Promise.all(
    inventoryItems.map((item, itemIdx) => {
      const podLink = itemPodLinks[itemIdx];
      return {
        "Client Name": item.entity ?? "PWC",
        "Delivery Location": item.deliveredLocation ?? "",
        "DC Number": item.dcNumber ?? item.latestDc ?? "",
        "Status": normaliseStatus(item.status),
        "Docket Number": item.latestDocketNumber ?? item.docketNumber ?? "",
        "E-Way Bill Number": item.latestEwayBill ?? item.ewayBill ?? "",
        "POD File": splitLastSegment(item.podDocumentUrl),
        "POD Download Link (click to download)": podLink,
        "Serial Numbers": item.serialNumber ?? "",
        "Created At": getVal(item as unknown as Record<string, unknown>, "createdAt"),
      };
    })
  );

  const rows = orderRows.concat(inventoryRows);

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, "PODs");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pod-report-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}