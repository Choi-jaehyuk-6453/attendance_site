
import { db } from "./server/db";
import { users, sites } from "./shared/schema";
import { eq } from "drizzle-orm";

async function run() {
    console.log("=== Debugging Site Managers ===");

    // Get all sites
    const allSites = await db.select().from(sites);
    console.log(`Total Sites: ${allSites.length}`);

    // Get all site managers
    const managers = await db.select().from(users).where(eq(users.role, "site_manager"));
    console.log(`Total Site Managers: ${managers.length}`);

    for (const manager of managers) {
        const assignedSite = allSites.find(s => s.id === manager.siteId);
        console.log(`Manager: ${manager.name} (${manager.username})`);
        console.log(`  - Company: ${manager.company}`);
        console.log(`  - SiteID: ${manager.siteId}`);
        if (assignedSite) {
            console.log(`  - Assigned Site: ${assignedSite.name} (Company: ${assignedSite.company})`);
            if (assignedSite.company !== manager.company) {
                console.warn(`  !!!! MISMATCH: Manager company (${manager.company}) != Site company (${assignedSite.company})`);
            }
        } else {
            console.warn(`  !!!! ORPHAN: Manager has siteId ${manager.siteId} but site not found.`);
        }
    }

    process.exit(0);
}

run().catch(console.error);
