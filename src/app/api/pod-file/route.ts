import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canViewModule } from "@/lib/permissions";
import { readFileBytes } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

const POD_VIEW_MODULES = ["logistics", "reverse-pickup", "warehouse"] as const;

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!POD_VIEW_MODULES.some(m => canViewModule(user.permissions, user.role, m))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  try {
    const buffer = await readFileBytes(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
