
import { storage } from "../server/storage";

async function run() {
    console.log("Auditing Site Data...");
    const sites = await storage.getSites();

    const siteCounts: Record<string, number> = {};

    for (const site of sites) {
        const company = site.company || "none";
        if (!siteCounts[company]) siteCounts[company] = 0;
        siteCounts[company]++;

        console.log(`Site: ${site.name} (${site.id}) - Company: ${company}`);
    }

    console.log("--- Site Counts by Company ---");
    console.log(siteCounts);

    process.exit(0);
}

run().catch(console.error);
