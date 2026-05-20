import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "galadv73@gmail.com";

export async function GET() {
  try {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      return NextResponse.json({ error: "DATABASE_URL not set in environment variables" }, { status: 500 });
    }

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
        "passwordHash" TEXT,
        "name" TEXT,
        "role" "Role" NOT NULL DEFAULT 'VIEWER',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "User_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE IF NOT EXISTS "OtpCode" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "used" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
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
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MarketOverride_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
      // Patch columns in case table existed from a previous partial run
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT`,
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT`,
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
           CREATE TYPE "Role" AS ENUM ('ADMIN', 'TRADER', 'VIEWER');
         END IF;
       END $$`,
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT 'VIEWER'`,
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
      `CREATE INDEX IF NOT EXISTS "OtpCode_email_idx" ON "OtpCode"("email")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "MarketOverride_conditionId_key" ON "MarketOverride"("conditionId")`,
      `ALTER TABLE "TradeLog" DROP CONSTRAINT IF EXISTS "TradeLog_userId_fkey"`,
      `ALTER TABLE "TradeLog" ADD CONSTRAINT "TradeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
      `ALTER TABLE "SignalLog" DROP CONSTRAINT IF EXISTS "SignalLog_userId_fkey"`,
      `ALTER TABLE "SignalLog" ADD CONSTRAINT "SignalLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    ];

    for (const stmt of statements) {
      await sql.query(stmt);
    }

    const now = new Date().toISOString();
    await sql.query(
      `INSERT INTO "User" ("id","email","role","createdAt","updatedAt")
       VALUES ($1,$2,'ADMIN',$3,$4)
       ON CONFLICT ("email") DO UPDATE SET "role"='ADMIN', "updatedAt"=$4`,
      [randomUUID(), ADMIN_EMAIL, now, now]
    );

    return NextResponse.json({ ok: true, message: "Database ready. Admin account created.", adminEmail: ADMIN_EMAIL });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
