import { NextResponse } from "next/server";
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

  // Delete expired or old unused codes for this email
  await db.otpCode.deleteMany({
    where: { email, OR: [{ expiresAt: { lt: new Date() } }, { used: true }] },
  });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.otpCode.create({ data: { email, code, expiresAt } });

  // Mock: return the code so the UI can display it.
  // Replace with email delivery (Resend, SendGrid, etc.) when ready.
  return NextResponse.json({ code });
}
