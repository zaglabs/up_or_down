import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const sql = neon(DATABASE_URL);

const statements = [
  `CREATE SCHEMA IF NOT EXISTS "public"`,

  // Enums (idempotent via exception handler)
  `DO $$ BEGIN
     CREATE TYPE "Role" AS ENUM ('ADMIN', 'TRADER', 'VIEWER');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,

  `DO $$ BEGIN
     CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$`,

  // Tables
  `CREATE TABLE IF NOT EXISTS "User" (
    "id"           TEXT        NOT NULL,
    "email"        TEXT        NOT NULL,
    "passwordHash" TEXT,
    "name"         TEXT,
    "role"         "Role"      NOT NULL DEFAULT 'VIEWER',
    "status"       "UserStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
  )`,

  // Add columns that may be missing if table was created by old setup script
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name"         TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status"       "UserStatus" NOT NULL DEFAULT 'PENDING'`,

  `CREATE TABLE IF NOT EXISTS "TradeLog" (
    "id"          TEXT             NOT NULL,
    "userId"      TEXT,
    "conditionId" TEXT             NOT NULL,
    "question"    TEXT             NOT NULL,
    "asset"       TEXT             NOT NULL,
    "direction"   TEXT             NOT NULL,
    "amount"      DOUBLE PRECISION NOT NULL,
    "entryPrice"  DOUBLE PRECISION NOT NULL,
    "exitPrice"   DOUBLE PRECISION,
    "pnl"         DOUBLE PRECISION,
    "mode"        TEXT             NOT NULL,
    "status"      TEXT             NOT NULL,
    "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"  TIMESTAMP(3),
    CONSTRAINT "TradeLog_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "SignalLog" (
    "id"          TEXT         NOT NULL,
    "userId"      TEXT,
    "conditionId" TEXT         NOT NULL,
    "question"    TEXT         NOT NULL,
    "asset"       TEXT         NOT NULL,
    "direction"   TEXT         NOT NULL,
    "confidence"  INTEGER      NOT NULL,
    "provider"    TEXT         NOT NULL,
    "reasoning"   TEXT,
    "indicators"  JSONB,
    "latencyMs"   INTEGER,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SignalLog_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "ApiLog" (
    "id"         TEXT         NOT NULL,
    "service"    TEXT         NOT NULL,
    "endpoint"   TEXT         NOT NULL,
    "statusCode" INTEGER      NOT NULL,
    "latencyMs"  INTEGER      NOT NULL,
    "error"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiLog_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "OtpCode" (
    "id"        TEXT         NOT NULL,
    "email"     TEXT         NOT NULL,
    "code"      TEXT         NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used"      BOOLEAN      NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "MarketOverride" (
    "id"             TEXT         NOT NULL,
    "conditionId"    TEXT         NOT NULL,
    "question"       TEXT         NOT NULL,
    "asset"          TEXT         NOT NULL,
    "pinned"         BOOLEAN      NOT NULL DEFAULT false,
    "notes"          TEXT,
    "signalOverride" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketOverride_pkey" PRIMARY KEY ("id")
  )`,

  // Indexes
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key"             ON "User"("email")`,
  `CREATE INDEX        IF NOT EXISTS "OtpCode_email_idx"          ON "OtpCode"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "MarketOverride_conditionId_key" ON "MarketOverride"("conditionId")`,

  // Foreign keys (drop first so re-runs are safe)
  `ALTER TABLE "TradeLog"  DROP CONSTRAINT IF EXISTS "TradeLog_userId_fkey"`,
  `ALTER TABLE "TradeLog"  ADD  CONSTRAINT "TradeLog_userId_fkey"
     FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,

  `ALTER TABLE "SignalLog" DROP CONSTRAINT IF EXISTS "SignalLog_userId_fkey"`,
  `ALTER TABLE "SignalLog" ADD  CONSTRAINT "SignalLog_userId_fkey"
     FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
];

for (const stmt of statements) {
  const preview = stmt.trim().split("\n")[0].slice(0, 80);
  try {
    await sql.query(stmt);
    console.log(`✓ ${preview}`);
  } catch (err) {
    console.error(`✗ ${preview}\n  ${err.message}`);
    process.exit(1);
  }
}

console.log("\n✅ Database schema is up to date.");
