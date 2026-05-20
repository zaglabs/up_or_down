import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await db.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: Record<string, string> = {};
  if (body.role) data.role = body.role;
  if (body.status) data.status = body.status;
  const user = await db.user.update({
    where: { id: params.id },
    data,
    select: { id: true, email: true, role: true, status: true },
  });
  return NextResponse.json(user);
}
