import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getSupabaseStorage, POD_BUCKET } from "@/lib/supabase/storage";
import JSZip from "jszip";

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
      dockets: {
        where: { podDocumentUrl: { not: null } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const supabase = getSupabaseStorage();
  const zip = new JSZip();

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
      zip.file(fileName, new Uint8Array(arrBuf));
    }
  }

  const zipData = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });

  return new NextResponse(zipData, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="pods-${new Date().toISOString().split("T")[0]}.zip"`,
    },
  });
}
