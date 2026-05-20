import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await db.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { role } = await req.json();
  const user = await db.user.update({
    where: { id: params.id },
    data: { role },
    select: { id: true, email: true, role: true },
  });
  return NextResponse.json(user);
}
