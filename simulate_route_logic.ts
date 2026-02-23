
import { db } from "./server/db";
import { users } from "./shared/schema";
import { eq } from "drizzle-orm";
// We can't easily simulate the session cookie without a full login flow. 
// Instead, we will rely on the server logs I just added. 
// I will trigger a request from the frontend by asking the user to refresh.
// But wait, the user is angry. 
// I can try to use the *internal* storage function call with the same parameters as the route handler.

import { storage } from "./server/storage";

async function run() {
    console.log("=== Internal Storage Simulation ===");
    // Simulate what routes.ts does

    // 1. Get current user (admin)
    const admin = await storage.getUserByUsername("관리자");
    if (!admin) {
        console.error("Admin user not found!");
        return;
    }
    console.log(`Admin found: ${admin.username} (${admin.role}), Company: ${admin.company}`);

    const targetCompany = "dawon_pmc";
    console.log(`Targeting company: ${targetCompany}`);

    // Replicate routes.ts logic MANUALLY here to see if it works
    const allSites = await storage.getSites();
    const companySites = allSites.filter(s => s.company === targetCompany);
    const companySiteIds = companySites.map(s => s.id);
    console.log(`Company Site IDs: ${companySiteIds.length} found`);

    const allUsers = await storage.getUsers();

    // The Filter Logic
    const filteredUsers = allUsers.filter(u =>
        (u.siteId && companySiteIds.includes(u.siteId)) ||
        u.id === admin.id ||
        u.company === targetCompany
    );

    console.log(`Expected Return Count: ${filteredUsers.length}`);
    const managers = filteredUsers.filter(u => u.role === 'site_manager');
    console.log("Managers in result:");
    managers.forEach(m => {
        console.log(`- ${m.name}, Site: ${m.siteId}, Company: ${m.company}`);
    });
}

run().catch(console.error);
