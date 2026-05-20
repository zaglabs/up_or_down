import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CreateSchema = z.object({
  email: z.email(),
  name: z.string().optional(),
  role: z.enum(["ADMIN", "TRADER", "VIEWER"]).default("VIEWER"),
});

export async function GET() {
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { email, name, role } = parsed.data;

  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const user = await db.user.create({
    data: { email, name, role },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}
