// Run with: npx tsx prisma/seed.ts
import "dotenv/config";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

function cuid(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString("hex");
  return `c${timestamp}${random}`;
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);

  try {
    const [rows] = await connection.execute(
      "SELECT id FROM `User` WHERE `username` = ?",
      ["admin"]
    );

    if (Array.isArray(rows) && rows.length > 0) {
      console.log("Admin user already exists, skipping seed.");
      return;
    }

    const passwordHash = await bcrypt.hash("admin", 10);
    const now = new Date().toISOString().slice(0, 23).replace("T", " ");

    await connection.execute(
      `INSERT INTO \`User\` (id, username, displayName, email, passwordHash, role, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cuid(), "admin", "Administrator", "admin@localhost", passwordHash, "ADMIN", now, now]
    );

    console.log("Seeded admin user (username: admin, password: admin)");
  } finally {
    await connection.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
