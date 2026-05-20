import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

// One-time DB setup endpoint. Protected by SETUP_SECRET env var.
// Delete this file after running once.
export async function POST(req: Request) {
  const secret = process.env.SETUP_SECRET;
  if (!secret) return NextResponse.json({ error: "SETUP_SECRET not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 });

  const sql = neon(DATABASE_URL);

  const statements = [
    `CREATE SCHEMA IF NOT EXISTS "public"`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
         CREATE TYPE "Role" AS ENUM ('ADMIN', 'TRADER', 'VIEWER');
       END IF;
     END $$`,
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "name" TEXT,
      "role" "Role" NOT NULL DEFAULT 'VIEWER',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "User_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "TradeLog" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "conditionId" TEXT NOT NULL,
      "question" TEXT NOT NULL,
      "asset" TEXT NOT NULL,
      "direction" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "entryPrice" DOUBLE PRECISION NOT NULL,
      "exitPrice" DOUBLE PRECISION,
      "pnl" DOUBLE PRECISION,
      "mode" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "resolvedAt" TIMESTAMP(3),
      CONSTRAINT "TradeLog_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "SignalLog" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "conditionId" TEXT NOT NULL,
      "question" TEXT NOT NULL,
      "asset" TEXT NOT NULL,
      "direction" TEXT NOT NULL,
      "confidence" INTEGER NOT NULL,
      "provider" TEXT NOT NULL,
      "reasoning" TEXT,
      "indicators" JSONB,
      "latencyMs" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SignalLog_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "ApiLog" (
      "id" TEXT NOT NULL,
      "service" TEXT NOT NULL,
      "endpoint" TEXT NOT NULL,
      "statusCode" INTEGER NOT NULL,
      "latencyMs" INTEGER NOT NULL,
      "error" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ApiLog_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "MarketOverride" (
      "id" TEXT NOT NULL,
      "conditionId" TEXT NOT NULL,
      "question" TEXT NOT NULL,
      "asset" TEXT NOT NULL,
      "pinned" BOOLEAN NOT NULL DEFAULT false,
      "notes" TEXT,
      "signalOverride" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "MarketOverride_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "MarketOverride_conditionId_key" ON "MarketOverride"("conditionId")`,
    `ALTER TABLE "TradeLog" DROP CONSTRAINT IF EXISTS "TradeLog_userId_fkey"`,
    `ALTER TABLE "TradeLog" ADD CONSTRAINT "TradeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    `ALTER TABLE "SignalLog" DROP CONSTRAINT IF EXISTS "SignalLog_userId_fkey"`,
    `ALTER TABLE "SignalLog" ADD CONSTRAINT "SignalLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  ];

  const results: { stmt: string; ok: boolean; error?: string }[] = [];

  for (const stmt of statements) {
    const preview = stmt.trim().split("\n")[0].slice(0, 80);
    try {
      await sql.query(stmt);
      results.push({ stmt: preview, ok: true });
    } catch (err) {
      results.push({ stmt: preview, ok: false, error: (err as Error).message });
      return NextResponse.json({ success: false, results }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, results });
}
