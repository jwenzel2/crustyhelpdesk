// Run with: npx tsx prisma/seed.ts
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMySQL } from "@prisma/adapter-mysql";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const pool = mysql.createPool(process.env.DATABASE_URL!);
const adapter = new PrismaMySQL(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.user.findUnique({
    where: { username: "admin" },
  });

  if (existing) {
    console.log("Admin user already exists, skipping seed.");
    return;
  }

  const passwordHash = await bcrypt.hash("admin", 10);

  await prisma.user.create({
    data: {
      username: "admin",
      displayName: "Administrator",
      email: "admin@localhost",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("Seeded admin user (username: admin, password: admin)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
