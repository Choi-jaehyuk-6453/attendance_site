
import { storage } from "../server/storage";

async function run() {
    console.log("Analyzing User Data...");
    const users = await storage.getUsers();
    const sites = await storage.getSites();
    const siteMap = new Map(sites.map(s => [s.id, s]));

    let mismatchCount = 0;
    let noSiteCount = 0;
    const companyCounts: Record<string, number> = {};

    for (const user of users) {
        if (!companyCounts[user.company || "none"]) companyCounts[user.company || "none"] = 0;
        companyCounts[user.company || "none"]++;

        if (!user.siteId) {
            noSiteCount++;
            continue;
        }

        const site = siteMap.get(user.siteId);
        if (!site) {
            console.log(`[ORPHAN] User ${user.name} (${user.id}) has siteId ${user.siteId} which does not exist.`);
            continue;
        }

        if (user.company !== site.company) {
            mismatchCount++;
            console.log(`[MISMATCH] User ${user.name} (${user.company}) - Site ${site.name} (${site.company})`);
        }
    }

    console.log("--- Summary ---");
    console.log("Total Users:", users.length);
    console.log("Company Counts:", companyCounts);
    console.log("Users without Site:", noSiteCount);
    console.log("Company Mismatches:", mismatchCount);

    process.exit(0);
}

run().catch(console.error);
