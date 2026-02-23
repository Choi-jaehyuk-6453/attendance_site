
import { storage } from "../server/storage";

async function run() {
    const targetName = "박소장";
    console.log(`Searching for users with name '${targetName}'...`);

    const users = await storage.getUsers();
    const matched = users.filter(u => u.name === targetName);

    if (matched.length === 0) {
        console.log("No users found.");
    } else {
        for (const u of matched) {
            const site = u.siteId ? await storage.getSite(u.siteId) : null;
            console.log(`User ID: ${u.id}`);
            console.log(`  Username: ${u.username}`);
            console.log(`  Role: ${u.role}`);
            console.log(`  Site ID: ${u.siteId}`);
            console.log(`  Site Name: ${site ? site.name : "N/A"}`);
            console.log(`  Company: ${u.company}`);
            console.log(`  IsActive: ${u.isActive}`);
            console.log("------------------------------------------------");
        }
    }

    process.exit(0);
}

run().catch(console.error);
