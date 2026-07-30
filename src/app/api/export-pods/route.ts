import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getSupabaseStorage, POD_BUCKET } from "@/lib/supabase/storage";
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

export async function GET() {
  const user = await getSession();
  if (!user || (user.role !== "ADMIN" && user.role !== "LOGISTICS")) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

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

  const supabase = getSupabaseStorage();

  const rows = await Promise.all(
    orders.flatMap((order) =>
      order.dockets.map(async (docket) => {
        let podLink = "";
        if (docket.podDocumentUrl) {
          const { data } = await supabase.storage
            .from(POD_BUCKET)
            .createSignedUrl(docket.podDocumentUrl, 604800);
          if (data) podLink = data.signedUrl;
        }

        return {
          "Client Name": order.clientName,
          "Delivery Location": order.deliveryLocation,
          "DC Number": order.dcNumber ?? "",
          "Status": order.status,
          "Docket Number": docket.docketNumber ?? "",
          "E-Way Bill Number": docket.ewayBillNumber ?? "",
          "POD Download Link": podLink,
          "Serial Numbers": order.assets
            .filter((a) => a.inventoryItem)
            .map((a) => a.inventoryItem!.serialNumber)
            .join(", "),
          "Created At": getVal(docket as unknown as Record<string, unknown>, "createdAt"),
        };
      })
    )
  );

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
