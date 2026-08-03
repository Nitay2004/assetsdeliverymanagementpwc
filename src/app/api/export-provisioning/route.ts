import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as XLSX from "xlsx";

const HEADERS = [
  "S.no",
  "LOT Received date",
  "Product",
  "Serial No",
  "Model",
  "Owner of the Asset",
  "Dev IT Inward Lot No",
  "HP Lot Number",
  "Provisioning Location",
  "Provisioned Date",
  "Master Provision Status-1 NEW",
  "Asset Remarks",
  "Condition (Working/Non Working)",
  "Current warehouse location",
  "Engineer Name",
  "PWC Image",
  "PWCEntity",
  "Shipping Date",
  "Storage Status",
  "Courier Name",
  "Docket #",
  "CONFIRMATION DISPLAY",
  "RACK NO",
  "REMARKS",
  "Delivery Date",
  "Warranty End Date",
  "Previous image date",
  "Latest Employee Name",
  "Location - City",
  "Latest Shipped Date (Provision Image)",
  "Courier Name",
  "Latest Docket No",
  "Latest Tracking Status",
  "Latest Eway Bill",
  "Latest Delivery Date",
  "Latest DC",
  "Outward date - 1",
  "Inward date - 1",
  "Outward date - 2",
  "Inward date - 2",
  "Outward date - 3",
  "Inward date - 3",
  "Outward date - 4",
  "Inward date - 4",
  "Outward date - 5",
  "Inward date - 5",
  "Outward date - 6",
  "Inward date - 6",
];

function dateStr(d: Date | null | undefined): string {
  if (!d || isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

export async function GET() {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "PROVISIONING")) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const items = await prisma.inventoryItem.findMany({
    orderBy: [{ sr: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });

  let sr = 1;
  const rows: unknown[][] = [];
  for (const inv of items) {
    rows.push([
      sr++,
      dateStr(inv.lotReceivedDate),
      inv.partNo ?? "",
      inv.serialNumber ?? "",
      inv.model ?? "",
      inv.partner ?? "",
      inv.devItInwardLotNo ?? "",
      inv.hpLotNumber ?? "",
      inv.userBaseLocation ?? "",
      dateStr(inv.requestDate),
      inv.processStatus ?? "",
      inv.assetRemarks ?? "",
      inv.condition ?? "",
      inv.invoicingWarehouse ?? "",
      inv.engineerName ?? "",
      inv.imageType ?? "",
      inv.entity ?? "",
      dateStr(inv.shippingDate),
      inv.storageStatus ?? "",
      inv.vendor ?? "",
      inv.docketNumber ?? "",
      inv.checkField ?? "",
      inv.rackNo ?? "",
      inv.remark ?? "",
      dateStr(inv.deliveryDate),
      dateStr(inv.warrantyEndPeriod),
      dateStr(inv.previousImageDate),
      inv.employeeName ?? "",
      inv.city ?? "",
      dateStr(inv.latestShippedDate),
      inv.latestCourierName ?? inv.vendor ?? "",
      inv.latestDocketNumber ?? "",
      inv.latestTrackingStatus ?? "",
      inv.latestEwayBill ?? "",
      dateStr(inv.latestDeliveryDate),
      inv.latestDc ?? "",
      dateStr(inv.outwardDate1),
      dateStr(inv.inwardDate1),
      dateStr(inv.outwardDate2),
      dateStr(inv.inwardDate2),
      dateStr(inv.outwardDate3),
      dateStr(inv.inwardDate3),
      dateStr(inv.outwardDate4),
      dateStr(inv.inwardDate4),
      dateStr(inv.outwardDate5),
      dateStr(inv.inwardDate5),
      dateStr(inv.outwardDate6),
      dateStr(inv.inwardDate6),
    ]);
  }

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  XLSX.utils.book_append_sheet(wb, sheet, "Provisioning Report");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="provisioning-report-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
