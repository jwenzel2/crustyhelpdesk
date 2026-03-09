import { PrismaClient } from "@/generated/prisma";
import { PrismaMySql2 } from "@prisma/adapter-mysql2";
import mysql from "mysql2/promise";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = mysql.createPool(process.env.DATABASE_URL!);
  const adapter = new PrismaMySql2(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
