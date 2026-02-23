
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function checkAdmins() {
    const result = await db.select().from(users).where(eq(users.role, "hq_admin"));
    console.log("Found admins:", result);
    process.exit(0);
}

checkAdmins();
