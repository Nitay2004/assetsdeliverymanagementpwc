import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canViewModule } from "@/lib/permissions";
import { podFileUrl } from "@/lib/storage";

// The POD link lives in the inventory drawer, so inventory view access is what
// grants it. Anyone who can open the row must be able to open the document.
const POD_VIEW_MODULES = ["inventory", "logistics", "reverse-pickup", "warehouse"] as const;

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
    return NextResponse.json({ url: await podFileUrl(filePath) });
  } catch (err) {
    console.error("pod-url error:", err);
    return NextResponse.json({ error: "Failed to build URL" }, { status: 500 });
  }
}
