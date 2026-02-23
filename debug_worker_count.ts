
import { db } from "./server/db";
import { users, sites } from "./shared/schema";
import { eq, and } from "drizzle-orm";

async function run() {
    console.log("=== Inspecting Worker Data ===");

    const targetCompany = "dawon_pmc";
    // We suspect the issue is with Dawon PMC based on previous context, but will check both if needed.

    console.log(`Target Company: ${targetCompany}`);

    const allSites = await db.select().from(sites).where(eq(sites.company, targetCompany));
    console.log(`Sites found: ${allSites.length}`);
    allSites.forEach(s => console.log(`- Site: ${s.name} (${s.id})`));

    const allWorkers = await db.select().from(users).where(and(eq(users.role, "worker"), eq(users.company, targetCompany)));
    console.log(`Workers found: ${allWorkers.length}`);

    allWorkers.forEach(w => {
        console.log(`- Worker: ${w.name} | SiteId: ${w.siteId} | Company: ${w.company}`);
        const assignedSite = allSites.find(s => s.id === w.siteId);
        console.log(`  -> Assigned to visible site? ${assignedSite ? "YES (" + assignedSite.name + ")" : "NO"}`);
    });

    // Check for workers that might belong to the site but have WRONG company
    const siteIds = allSites.map(s => s.id);
    if (siteIds.length > 0) {
        const mismatchedWorkers = await db.select().from(users).where(and(eq(users.role, "worker"))); // Get all workers first
        const actuallyAssigned = mismatchedWorkers.filter(w => siteIds.includes(w.siteId || "") && w.company !== targetCompany);

        if (actuallyAssigned.length > 0) {
            console.log("\n!!! FOUND MISMATCHED WORKERS !!!");
            actuallyAssigned.forEach(w => {
                console.log(`- Worker: ${w.name} | SiteId: ${w.siteId} | Company: ${w.company} (Should be ${targetCompany})`);
            });
        }
    }

    process.exit(0);
}

run().catch(console.error);
