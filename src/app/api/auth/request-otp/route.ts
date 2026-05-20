import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "No account found for this email" }, { status: 404 });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret");

  const token = await new SignJWT({ email, code })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(secret);

  // Mock: return the code so the UI can display it.
  // In production, send via email and omit `code` from the response.
  return NextResponse.json({ token, code });
}
