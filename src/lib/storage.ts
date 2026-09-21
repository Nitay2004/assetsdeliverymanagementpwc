import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const POD_BUCKET = "pod";

const STORAGE_BUCKET = "pod_upload";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

let _client: SupabaseClient | null = null;

function isSupabaseEnabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

function supabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

function assertSafePodPath(subPath: string): string {
  const normalized = subPath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (segments.some(seg => seg === ".." || seg === ".")) {
    throw new Error("Invalid path");
  }
  if (normalized.startsWith("/") || normalized.includes(":")) {
    throw new Error("Invalid path");
  }
  if (!normalized.startsWith(`${POD_BUCKET}/`)) {
    throw new Error("Path must be scoped to the pod bucket");
  }
  return normalized;
}

export async function saveFile(
  subPath: string,
  buffer: Buffer
): Promise<string> {
  const normalized = subPath.replace(/\\/g, "/");
  assertSafePodPath(normalized);
  if (isSupabaseEnabled()) {
    const ext = normalized.split(".").pop()?.toLowerCase() ?? "";
    const { error } = await supabase().storage.from(STORAGE_BUCKET).upload(normalized, buffer, {
      contentType: MIME_TYPES[ext] ?? "application/octet-stream",
      upsert: true,
    });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    return normalized;
  }
  const fullPath = path.join(UPLOAD_DIR, subPath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return normalized;
}

export function resolveFilePath(subPath: string): string {
  const normalized = assertSafePodPath(subPath);
  const resolved = path.resolve(UPLOAD_DIR, normalized);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
    throw new Error("Invalid path");
  }
  return resolved;
}

export async function readFileBytes(subPath: string): Promise<Buffer> {
  const normalized = assertSafePodPath(subPath);
  if (isSupabaseEnabled()) {
    const { data, error } = await supabase()
      .storage.from(STORAGE_BUCKET)
      .download(normalized);
    if (error || !data)
      throw new Error(`Supabase download failed: ${error?.message ?? "no data"}`);
    return Buffer.from(await data.arrayBuffer());
  }
  return readFile(resolveFilePath(subPath));
}

export async function podFileUrl(subPath: string): Promise<string> {
  const normalized = assertSafePodPath(subPath);
  if (isSupabaseEnabled()) {
    const { data, error } = await supabase()
      .storage.from(STORAGE_BUCKET)
      .createSignedUrl(normalized, 60 * 60);
    if (error || !data)
      throw new Error(`Supabase signed URL failed: ${error?.message ?? "no data"}`);
    return data.signedUrl;
  }
  return `/api/pod-file?path=${encodeURIComponent(normalized)}`;
}
