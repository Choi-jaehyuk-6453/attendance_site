import { storage } from "../server/storage";

async function run() {
    const siteName = "신월시영";
    console.log(`Searching for site '${siteName}'...`);

    const site = await storage.getSiteByName(siteName);
    if (!site) {
        console.log("Site not found.");
        process.exit(0);
        return;
    }

    console.log(`Found site: ID=${site.id}, Name=${site.name}, Company=${site.company}`);
    const users = await storage.getUsersBySite(site.id);
    console.log(`Found ${users.length} users in this site.`);

    for (const u of users) {
        console.log(`User ID: ${u.id} | Username: '${u.username}' | Name: '${u.name}' | Role: ${u.role} | Phone: '${u.phone}' | IsActive: ${u.isActive}`);
    }

    process.exit(0);
}

run().catch(console.error);
