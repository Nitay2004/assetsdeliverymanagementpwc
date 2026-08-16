import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { podFileUrl } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
