
import { storage } from "../server/storage";

async function run() {
    const users = await storage.getUsers();
    const sites = await storage.getSites();

    console.log("--- Site User Counts ---");
    for (const site of sites) {
        const siteUsers = users.filter(u => u.siteId === site.id);
        const activeUsers = siteUsers.filter(u => u.isActive);

        // Breakdown
        const activeWorkers = activeUsers.filter(u => u.role === "worker").length;
        const activeManagers = activeUsers.filter(u => u.role === "site_manager").length;
        const totalActive = activeUsers.length;

        console.log(`Site: ${site.name} (${site.company})`);
        console.log(`  Total Active: ${totalActive}`);
        console.log(`  - Workers: ${activeWorkers}`);
        console.log(`  - Managers: ${activeManagers}`);
        console.log(`  (Inactive: ${siteUsers.length - activeUsers.length})`);
        console.log("--------------------------");
    }

    process.exit(0);
}

run().catch(console.error);
