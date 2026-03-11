// Run with: npx tsx prisma/seed.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

async function main() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const existing = await prisma.user.findUnique({
      where: { username: "admin" },
    });

    if (existing) {
      console.log("Admin user already exists, skipping user seed.");
    } else {
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

    // Seed default categories
    const defaultCategories = ["Hardware", "Software", "Network", "Account Access", "General"];
    for (const name of defaultCategories) {
      await prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }
    console.log(`Seeded ${defaultCategories.length} default categories`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
