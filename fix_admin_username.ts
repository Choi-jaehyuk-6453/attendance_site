import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import pg from "pg";
import { users } from "./shared/schema.js";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const db = drizzle(pool);

async function main() {
  try {
    console.log("Renaming/deleting admin users to standardize on '관리자'...");

    // 1. Delete 'admin'
    await db.delete(users).where(eq(users.username, "admin"));
    console.log("Deleted old 'admin' user (if it existed).");

    // 2. Ensure '관리자' has password 'admin123'
    const adminPassword = await bcrypt.hash("admin123", 10);
    const existing = await db.select().from(users).where(eq(users.username, "관리자"));
    
    if (existing.length > 0) {
      await db.update(users)
        .set({ password: adminPassword })
        .where(eq(users.username, "관리자"));
      console.log("Updated existing '관리자' password to 'admin123'.");
    } else {
      await db.insert(users).values({
        username: "관리자",
        password: adminPassword,
        name: "본사관리자",
        role: "hq_admin",
        isActive: true,
        company: "mirae_abm"
      });
      console.log("Created '관리자' user with password 'admin123'.");
    }

    console.log("Done. HQ Admin login is '관리자' / 'admin123'.");
    pool.end();
  } catch (err) {
    console.error("Error modifying users:", err);
    pool.end();
  }
}

main();
