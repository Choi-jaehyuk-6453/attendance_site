import { storage } from "../server/storage";

async function checkData() {
    const sites = await storage.getSites();
    console.log("=== SITES ===");
    for (const s of sites) {
        console.log(`Site: ${s.name} | ID: ${s.id} | Company: ${s.company}`);
    }

    const users = await storage.getUsers();
    const siteManagers = users.filter((u: any) => u.role === "site_manager");

    console.log("\n=== SITE MANAGERS ===");
    for (const sm of siteManagers) {
        const site = sites.find((s: any) => s.id === sm.siteId);
        console.log(`SM: ${sm.name} | Username: ${sm.username} | Company: ${sm.company} | SiteName: ${site?.name || "Unknown"} | SiteID: ${sm.siteId}`);
    }
}

checkData().catch(console.error);
