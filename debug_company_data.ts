
// import "dotenv/config";
import { db } from "./server/db";
import { users, sites } from "./shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("=== Users ===");
    const allUsers = await db.select().from(users);
    allUsers.forEach(u => {
        console.log(`User: ${u.username} (${u.name}), Role: ${u.role}, Company: ${u.company}`);
    });

    console.log("\n=== Sites ===");
    const allSites = await db.select().from(sites);
    allSites.forEach(s => {
        console.log(`Site: ${s.name}, Company: ${s.company}, IsActive: ${s.isActive}`);
    });

    process.exit(0);
}

main().catch(console.error);
