import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE_NAME = "devit_session";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.session.deleteMany({ where: { token: hash } });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.redirect(new URL("/", request.url));
}
