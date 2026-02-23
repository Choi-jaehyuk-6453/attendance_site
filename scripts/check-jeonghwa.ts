
import { db } from "../server/db";
import { sites } from "../shared/schema";
import { like } from "drizzle-orm";

async function checkSite() {
    const result = await db.select().from(sites).where(like(sites.name, "%정화%"));
    console.log("Found sites:", result);
    process.exit(0);
}

checkSite();
