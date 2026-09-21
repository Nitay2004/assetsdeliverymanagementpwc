import { NextRequest, NextResponse } from "next/server";
import { saveFile, POD_BUCKET } from "@/lib/storage";
import { getSession } from "@/lib/auth";
import { canViewModule } from "@/lib/permissions";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MAGIC_BYTES: Record<string, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46],
  jpg: [0xff, 0xd8, 0xff],
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
};

function matchesMagic(buffer: Buffer, ext: string): boolean {
  const magic = MAGIC_BYTES[ext];
  if (!magic) return false;
  if (buffer.length < magic.length) return false;
  return magic.every((byte, i) => buffer[i] === byte);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      !canViewModule(user.permissions, user.role, "logistics") &&
      !canViewModule(user.permissions, user.role, "reverse-pickup") &&
      !canViewModule(user.permissions, user.role, "warehouse")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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

    if (buffer.length === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds the 10 MB limit" }, { status: 413 });
    }
    if (!matchesMagic(buffer, ext)) {
      return NextResponse.json({ error: "File content does not match its extension" }, { status: 400 });
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = await saveFile(`${POD_BUCKET}/${fileName}`, buffer);

    return NextResponse.json({ url: filePath });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
