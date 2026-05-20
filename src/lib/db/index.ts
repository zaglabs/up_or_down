import { PrismaClient } from "@prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Required for Prisma + Neon serverless in Next.js
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
