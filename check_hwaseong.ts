import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users, attendanceLogs } from "./shared/schema.js";
import { eq, and, sql } from "drizzle-orm";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const db = drizzle(pool);

async function main() {
  try {
    const [user] = await db.select().from(users).where(eq(users.name, "장화성"));
    if (!user) {
      console.log("No user named 장화성 found");
      return;
    }
    console.log(`User ID: ${user.id}`);

    const logs = await db.select().from(attendanceLogs).where(
      and(eq(attendanceLogs.userId, user.id))
    ).orderBy(sql`${attendanceLogs.checkInDate} DESC`);
    
    console.log("Logs for 장화성:", logs);
    pool.end();
  } catch (e) {
    console.error(e);
    pool.end();
  }
}
main();
