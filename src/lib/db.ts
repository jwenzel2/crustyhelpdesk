import { PrismaClient } from "@/generated/prisma";
import { PrismaMySQL } from "@prisma/adapter-mysql";
import mysql from "mysql2/promise";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = mysql.createPool(process.env.DATABASE_URL!);
  const adapter = new PrismaMySQL(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
