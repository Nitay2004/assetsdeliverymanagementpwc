import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getSupabaseStorage, POD_BUCKET } from "@/lib/supabase/storage";
import * as XLSX from "xlsx";
import { ZipArchive } from "archiver";

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

  const rows = orders.flatMap((order) =>
    order.dockets.map((docket) => ({
      "Client Name": order.clientName,
      "Delivery Location": order.deliveryLocation,
      "DC Number": order.dcNumber ?? "",
      "Status": order.status,
      "Docket Number": docket.docketNumber ?? "",
      "E-Way Bill Number": docket.ewayBillNumber ?? "",
      "POD File": docket.podDocumentUrl?.split("/").pop() ?? "",
      "Serial Numbers": order.assets
        .filter((a) => a.inventoryItem)
        .map((a) => a.inventoryItem!.serialNumber)
        .join(", "),
      "Created At": getVal(docket as unknown as Record<string, unknown>, "createdAt"),
    }))
  );

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, "PODs");
  const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const supabase = getSupabaseStorage();
  const chunks: { name: string; buffer: Buffer }[] = [];

  for (const order of orders) {
    for (const docket of order.dockets) {
      if (!docket.podDocumentUrl) continue;
      const fileName = docket.podDocumentUrl.split("/").pop();
      if (!fileName) continue;

      const { data, error } = await supabase.storage
        .from(POD_BUCKET)
        .download(docket.podDocumentUrl);

      if (error || !data) {
        console.error(`Failed to download ${docket.podDocumentUrl}:`, error?.message);
        continue;
      }

      const arrBuf = await data.arrayBuffer();
      chunks.push({ name: fileName, buffer: Buffer.from(arrBuf) });
    }
  }

  const archive = new ZipArchive({ zlib: { level: 5 } });
  const buffers: Buffer[] = [];
  archive.on("data", (d) => buffers.push(d));
  const zipPromise = new Promise<void>((resolve, reject) => {
    archive.on("end", resolve);
    archive.on("error", reject);
  });

  archive.append(xlsxBuffer, { name: `pod-report-${new Date().toISOString().split("T")[0]}.xlsx` });
  for (const chunk of chunks) {
    archive.append(chunk.buffer, { name: `pod-files/${chunk.name}` });
  }
  archive.finalize();
  await zipPromise;

  const zipBuffer = Buffer.concat(buffers);

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="pod-report-${new Date().toISOString().split("T")[0]}.zip"`,
    },
  });
}
