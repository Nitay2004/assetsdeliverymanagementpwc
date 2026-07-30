import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getSupabaseStorage, POD_BUCKET } from "@/lib/supabase/storage";
import JSZip from "jszip";
import * as XLSX from "xlsx";

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
  const zip = new JSZip();

  const xlsxRows: Record<string, string>[] = [];

  for (const order of orders) {
    for (const docket of order.dockets) {
      if (!docket.podDocumentUrl) continue;
      const fileName = docket.podDocumentUrl.split("/").pop();
      if (!fileName) continue;

      let signedUrl = "";
      const { data: urlData } = await supabase.storage
        .from(POD_BUCKET)
        .createSignedUrl(docket.podDocumentUrl, 604800);
      if (urlData) signedUrl = urlData.signedUrl;

      const { data, error } = await supabase.storage
        .from(POD_BUCKET)
        .download(docket.podDocumentUrl);

      if (!error && data) {
        const arrBuf = await data.arrayBuffer();
        zip.file(`pod-files/${fileName}`, new Uint8Array(arrBuf));
      } else {
        console.error(`Failed to download ${docket.podDocumentUrl}:`, error?.message);
      }

      xlsxRows.push({
        "Client Name": order.clientName,
        "Delivery Location": order.deliveryLocation,
        "DC Number": order.dcNumber ?? "",
        "Status": order.status,
        "Docket Number": docket.docketNumber ?? "",
        "E-Way Bill Number": docket.ewayBillNumber ?? "",
        "POD File": fileName,
        "POD Download Link": signedUrl,
        "Serial Numbers": order.assets
          .filter((a) => a.inventoryItem)
          .map((a) => a.inventoryItem!.serialNumber)
          .join(", "),
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(xlsxRows);
  XLSX.utils.book_append_sheet(wb, sheet, "PODs");
  const xlsxUint8 = XLSX.write(wb, { type: "uint8array", bookType: "xlsx" });
  zip.file(`pod-report-${new Date().toISOString().split("T")[0]}.xlsx`, xlsxUint8);

  const zipData = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });

  return new NextResponse(zipData, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="pods-${new Date().toISOString().split("T")[0]}.zip"`,
    },
  });
}
