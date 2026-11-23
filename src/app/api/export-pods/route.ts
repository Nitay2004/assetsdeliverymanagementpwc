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

  // Every inventory item carrying a POD — including bulk-imported rows that
  // have not been materialised into an order yet. The de-duplication below is
  // what prevents those two views of the same asset producing two sheet rows.
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { podDocumentUrl: { not: null } },
    orderBy: { createdAt: "desc" },
  });

  // Flat docket list with an explicit index. Indexing the resolved links with
  // `orderIdx * order.dockets.length` was wrong whenever two orders had a
  // different number of dockets — every row after that point got someone
  // else's download link.
  const docketEntries = orders.flatMap(order =>
    order.dockets.map(docket => ({ order, docket }))
  );
  const docketPodLinks = await Promise.all(
    docketEntries.map(({ docket }) =>
      docket.podDocumentUrl ? podFileUrl(docket.podDocumentUrl) : Promise.resolve("")
    )
  );

  const orderRows = await Promise.all(
    docketEntries.map(({ order, docket }, index) => ({
      "Client Name": order.clientName,
      "Delivery Location": order.deliveryLocation,
      "DC Number": order.dcNumber ?? "",
      "Status": normaliseStatus(order.status),
      "Docket Number": docket.docketNumber ?? "",
      "E-Way Bill Number": docket.ewayBillNumber ?? "",
      "POD File": splitLastSegment(docket.podDocumentUrl),
      "POD Download Link (click to download)": docketPodLinks[index],
      "Serial Numbers": order.assets
        .filter((a) => a.inventoryItem)
        .map((a) => a.inventoryItem!.serialNumber)
        .join(", "),
      "Created At": getVal(docket as unknown as Record<string, unknown>, "createdAt"),
    }))
  );

  // An asset that already appears through its order must not be repeated as an
  // inventory row. Match on both the POD document and the serial number: either
  // one uniquely identifies the same physical proof of delivery here.
  const representedPodPaths = new Set(
    docketEntries.map(({ docket }) => docket.podDocumentUrl).filter((url): url is string => Boolean(url))
  );
  const representedSerials = new Set(
    orderRows.flatMap(row => row["Serial Numbers"].split(", ").filter(Boolean))
  );
  const inventoryEntries = inventoryItems.filter(item =>
    !(item.podDocumentUrl && representedPodPaths.has(item.podDocumentUrl)) &&
    !(item.serialNumber && representedSerials.has(item.serialNumber))
  );

  const itemPodLinks = await Promise.all(
    inventoryEntries.map(item =>
      item.podDocumentUrl ? podFileUrl(item.podDocumentUrl) : Promise.resolve("")
    )
  );

  const inventoryRows = inventoryEntries.map((item, index) => ({
    "Client Name": item.entity ?? "PWC",
    "Delivery Location": item.deliveredLocation ?? "",
    "DC Number": item.dcNumber ?? item.latestDc ?? "",
    "Status": normaliseStatus(item.status),
    "Docket Number": item.latestDocketNumber ?? item.docketNumber ?? "",
    "E-Way Bill Number": item.latestEwayBill ?? item.ewayBill ?? "",
    "POD File": splitLastSegment(item.podDocumentUrl),
    "POD Download Link (click to download)": itemPodLinks[index],
    "Serial Numbers": item.serialNumber ?? "",
    "Created At": getVal(item as unknown as Record<string, unknown>, "createdAt"),
  }));

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