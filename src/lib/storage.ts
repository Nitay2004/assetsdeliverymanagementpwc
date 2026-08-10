import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

export const POD_BUCKET = "pod";

export async function saveFile(
  subPath: string,
  buffer: Buffer
): Promise<string> {
  const fullPath = path.join(UPLOAD_DIR, subPath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return subPath.replace(/\\/g, "/");
}

export function resolveFilePath(subPath: string): string {
  const resolved = path.resolve(UPLOAD_DIR, subPath);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
    throw new Error("Invalid path");
  }
  return resolved;
}

export async function readFileBytes(subPath: string): Promise<Buffer> {
  return readFile(resolveFilePath(subPath));
}

export function localFileUrl(subPath: string): string {
  return `/api/pod-file?path=${encodeURIComponent(subPath)}`;
}
