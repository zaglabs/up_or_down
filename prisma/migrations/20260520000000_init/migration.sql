-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TRADER', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeLog" (
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
);

-- CreateTable
CREATE TABLE "SignalLog" (
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
);

-- CreateTable
CREATE TABLE "ApiLog" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOverride" (
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
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "OtpCode_email_idx" ON "OtpCode"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MarketOverride_conditionId_key" ON "MarketOverride"("conditionId");

-- AddForeignKey
ALTER TABLE "TradeLog" ADD CONSTRAINT "TradeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalLog" ADD CONSTRAINT "SignalLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
