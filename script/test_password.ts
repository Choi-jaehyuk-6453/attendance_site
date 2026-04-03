import { storage } from "../server/storage";
import bcrypt from "bcryptjs";

async function checkPasswords() {
    const siteName = "신월시영";
    console.log(`Checking passwords for site '${siteName}'...`);
    const site = await storage.getSiteByName(siteName);
    if (!site) return;

    const users = await storage.getUsersBySite(site.id);
    console.log(`Found ${users.length} users. Checking 5 workers...`);

    let checked = 0;
    for (const u of users) {
        if (u.role === "worker" && u.phone) {
            const last4Digits = u.phone.replace(/\D/g, "").slice(-4);
            const isMatch = await bcrypt.compare(last4Digits, u.password);
            console.log(`Worker: ${u.name}, Phone: ${u.phone}, Last4: ${last4Digits}, HashMatch: ${isMatch}`);
            checked++;
            if (checked >= 5) break;
        }
    }
    process.exit(0);
}

checkPasswords().catch(console.error);
