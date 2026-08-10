import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { localFileUrl } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  return NextResponse.json({ url: localFileUrl(filePath) });
}
