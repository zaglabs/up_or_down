import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      await db.user.create({ data: { email, role: "VIEWER", status: "PENDING" } });
      return NextResponse.json({ pending: true }, { status: 202 });
    }
    if (user.status === "PENDING") {
      return NextResponse.json({ pending: true }, { status: 202 });
    }
    if (user.status === "DISABLED") {
      return NextResponse.json({ error: "Your account has been disabled. Contact the admin." }, { status: 403 });
    }

    await db.otpCode.deleteMany({
      where: { email, OR: [{ expiresAt: { lt: new Date() } }, { used: true }] },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.otpCode.create({ data: { email, code, expiresAt } });

    // Mock: return the code so the UI can display it.
    // Replace with email delivery when ready.
    return NextResponse.json({ code });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
