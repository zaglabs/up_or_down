import { NextResponse } from "next/server";
import { getAddressFromKey } from "@/lib/polymarket/clob-auth";
import { getBalanceAllowance } from "@/lib/polymarket/clob";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { privateKey } = await request.json();

    if (!privateKey || typeof privateKey !== "string") {
      return NextResponse.json({ error: "Private key required" }, { status: 400 });
    }

    const cleanKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;

    if (!/^0x[0-9a-fA-F]{64}$/.test(cleanKey)) {
      return NextResponse.json({ error: "Invalid private key format" }, { status: 400 });
    }

    const address = getAddressFromKey(cleanKey);
    const { balance, allowance } = await getBalanceAllowance(address);

    return NextResponse.json({ valid: true, address, balance, allowance });
  } catch (err) {
    console.error("Verify key error:", err);
    return NextResponse.json({ error: "Invalid private key" }, { status: 400 });
  }
}
