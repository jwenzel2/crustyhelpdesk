import { PrismaClient } from "@/generated/prisma";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import mariadb from "mariadb";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function parseDatabaseUrl(url: string) {
  const match = url.match(/^mysql:\/\/([^:]*):([^@]*)@([^:/?]+)(?::(\d+))?\/(.+)$/);
  if (!match) throw new Error("Invalid DATABASE_URL format");
  return {
    user: decodeURIComponent(match[1]),
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4] || "3306"),
    database: match[5],
  };
}

function createPrismaClient() {
  const config = parseDatabaseUrl(process.env.DATABASE_URL!);
  const pool = mariadb.createPool({ ...config, connectionLimit: 5 });
  const adapter = new PrismaMariaDb(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
