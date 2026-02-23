
import fs from 'fs';
import path from 'path';
import { sql } from "drizzle-orm";

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
    const { attendanceLogs, vacationRequests } = await import("../shared/schema");
    const { eq, or } = await import("drizzle-orm");

    const targetId = "2c6ee6f5-e72a-4dc1-84b2-605681e0e75f";

    // Select only ID to avoid column errors
    const logs = await db.select({ id: attendanceLogs.id }).from(attendanceLogs).where(eq(attendanceLogs.userId, targetId));
    const vacations = await db.select({ id: vacationRequests.id }).from(vacationRequests).where(or(eq(vacationRequests.userId, targetId), eq(vacationRequests.respondedBy, targetId)));

    console.log(`Attendance Logs: ${logs.length}`);
    console.log(`Vacation Requests: ${vacations.length}`);

    process.exit(0);
}

run();
