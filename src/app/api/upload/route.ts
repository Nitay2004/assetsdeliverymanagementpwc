import { NextRequest, NextResponse } from "next/server";
import { getSupabaseStorage, POD_BUCKET } from "@/lib/supabase/storage";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowed = ["pdf", "jpg", "jpeg", "png"];
    if (!ext || !allowed.includes(ext)) {
      return NextResponse.json({ error: "Only PDF, JPG, and PNG files are allowed" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `pod/${fileName}`;

    const supabase = getSupabaseStorage();
    const { error } = await supabase.storage
      .from(POD_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type || `application/${ext === "jpg" ? "jpeg" : ext}`,
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
    }

    return NextResponse.json({ url: filePath });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
