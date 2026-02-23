
import { db } from "./server/db";
import { users, sites } from "./shared/schema";
import { eq, inArray, and } from "drizzle-orm";

async function run() {
    console.log("=== Fixing Worker Company Assignment ===");

    const targetCompany = "dawon_pmc";

    // 1. Get all sites for Dawon PMC
    const dawonSites = await db.select().from(sites).where(eq(sites.company, targetCompany));
    const dawonSiteIds = dawonSites.map(s => s.id);

    console.log(`Found ${dawonSites.length} sites for Dawon PMC`);

    if (dawonSiteIds.length === 0) {
        console.log("No sites found. Exiting.");
        process.exit(0);
    }

    // 2. Find all workers assigned to these sites, REGARDLESS of their current company
    const affectedWorkers = await db.select().from(users).where(
        and(
            eq(users.role, "worker"),
            inArray(users.siteId, dawonSiteIds)
        )
    );

    console.log(`Found ${affectedWorkers.length} workers assigned to Dawon sites.`);

    // 4. List ALL USERS to see what exists
    console.log("=== Listing ALL USERS in DB ===");
    try {
        const allUsers = await db.select().from(users);
        console.log(`Total users found: ${allUsers.length}`);
        allUsers.forEach(u => {
            console.log(`- ${u.name} (${u.username}) | Role: ${u.role} | Company: ${u.company} | SiteId: ${u.siteId} | IsActive: ${u.isActive}`);
        });
    } catch (e) {
        console.error("Error fetching users:", e);
    }

    process.exit(0);
}

run().catch(console.error);
