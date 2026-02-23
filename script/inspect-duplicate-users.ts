
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

async function run() {
    const { db } = await import("../server/db");
    const { users } = await import("../shared/schema");
    const { eq, or } = await import("drizzle-orm");

    const targetSiteId = "ca5f7c98-07cb-44c6-8556-ec47bc7ff62f";

    const managers = await db.select().from(users).where(eq(users.siteId, targetSiteId));

    console.log("Managers for site:", targetSiteId);
    managers.forEach(u => {
        console.log(JSON.stringify(u, null, 2));
    });

    process.exit(0);
}

run();
