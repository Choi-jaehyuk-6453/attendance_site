
import fs from 'fs';
import path from 'path';

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

// Dynamic import to ensure env is loaded first
async function run() {
    const { db } = await import("../server/db");
    const { users } = await import("../shared/schema");
    const { eq } = await import("drizzle-orm");

    const allUsers = await db.select().from(users);
    console.log(`Total users: ${allUsers.length}`);

    const siteManagers = allUsers.filter(u => u.role === 'site_manager');
    console.log(`Site managers: ${siteManagers.length}`);

    siteManagers.forEach(u => {
        console.log(`- ${u.username} (${u.name}) Site: ${u.siteId}`);
    });

    // Check for exact duplicates by username + site
    const seen = new Set();
    const duplicates = [];
    for (const u of siteManagers) {
        const key = `${u.username}-${u.siteId}`;
        if (seen.has(key)) {
            duplicates.push(u);
        }
        seen.add(key);
    }

    if (duplicates.length > 0) {
        console.log("\nWARNING: Found duplicate managers for same site:");
        duplicates.forEach(d => console.log(d));
    } else {
        console.log("\nNo duplicate managers found.");
    }

    process.exit(0);
}

run();
