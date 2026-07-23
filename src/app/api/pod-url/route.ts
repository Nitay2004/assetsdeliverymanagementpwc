import { NextRequest, NextResponse } from "next/server";
import { getSupabaseStorage, POD_BUCKET } from "@/lib/supabase/storage";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const supabase = getSupabaseStorage();
  const { data, error } = await supabase.storage
    .from(POD_BUCKET)
    .createSignedUrl(filePath, 3600);

  if (error) {
    console.error("Signed URL error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
