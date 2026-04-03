import { db } from "../server/db";
import { sites } from "../shared/schema";
import { eq } from "drizzle-orm";

async function checkSites() {
    const siteName = "신월시영";
    const foundSites = await db.select().from(sites).where(eq(sites.name, siteName));
    
    console.log(`Found ${foundSites.length} sites named '${siteName}':`);
    for (const site of foundSites) {
        console.log(`ID: ${site.id}, isActive: ${site.isActive}, company: ${site.company}`);
    }
    process.exit(0);
}

checkSites().catch(console.error);
