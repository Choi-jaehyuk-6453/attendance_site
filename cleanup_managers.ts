
import { db } from "./server/db";
import { users } from "./shared/schema";
import { eq, and } from "drizzle-orm";

async function run() {
    console.log("=== Cleaning up Managers ===");
    // Find all managers named "김솔휘"
    const managers = await db.select().from(users).where(eq(users.name, "김솔휘"));
    console.log(`Found ${managers.length} managers named 김솔휘`);

    for (let i = 0; i < managers.length; i++) {
        const m = managers[i];
        if (m.company === "dawon_pmc") {
            const newName = `김솔휘${i + 1}`; // Make unique
            console.log(`Updating ${m.id} to ${newName}`);
            await db.update(users).set({ name: newName }).where(eq(users.id, m.id));
        }
    }
}
run().catch(console.error);
