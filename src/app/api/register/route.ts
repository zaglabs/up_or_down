import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, name } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.status === "PENDING") {
        return NextResponse.json({ error: "A request for this email is already pending." }, { status: 409 });
      }
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    await db.user.create({
      data: { email, name: name || null, status: "PENDING", role: "VIEWER" },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
