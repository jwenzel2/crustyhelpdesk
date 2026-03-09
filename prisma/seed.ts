// Run with: npx tsx prisma/seed.ts
// Requires: prisma generate to have been run first
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

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
  .finally(() => prisma.$disconnect());
