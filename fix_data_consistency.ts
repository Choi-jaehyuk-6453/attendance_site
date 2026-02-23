
import { db } from "./server/db";
import { users, sites } from "./shared/schema";
import { eq } from "drizzle-orm";

async function run() {
    console.log("=== Fixing Data Consistency ===");

    const allSites = await db.select().from(sites);
    const allUsers = await db.select().from(users);

    let fixedCount = 0;

    for (const user of allUsers) {
        if (!user.siteId) continue;

        const site = allSites.find(s => s.id === user.siteId);
        if (site) {
            if (user.company !== site.company) {
                console.log(`Fixing user ${user.name} (${user.role}): ${user.company} -> ${site.company}`);
                await db.update(users)
                    .set({ company: site.company })
                    .where(eq(users.id, user.id));
                fixedCount++;
            }
        }
    }

    console.log(`Fixed ${fixedCount} users.`);
    process.exit(0);
}

run().catch(console.error);
