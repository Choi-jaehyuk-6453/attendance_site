
import { db } from "./server/db";
import { sites } from "./shared/schema";

async function checkSites() {
    console.log("Checking recent sites...");
    // Simple select without order to avoid syntax issues if any
    const recentSites = await db.select().from(sites);

    if (recentSites.length === 0) {
        console.log("No sites found.");
    } else {
        console.table(recentSites.map(s => ({
            id: s.id,
            name: s.name,
            company: s.company
        })));
    }
    process.exit(0);
}

checkSites().catch(console.error);
