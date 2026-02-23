
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
    const { users, attendanceLogs, vacationRequests } = await import("../shared/schema");
    const { eq, or } = await import("drizzle-orm");

    const targetId = "2c6ee6f5-e72a-4dc1-84b2-605681e0e75f"; // Username: 최재혁

    console.log(`Deleting related records for user: ${targetId}`);

    // Delete attendance logs
    // Use sql to avoid column mismatch if source column is missing
    await db.execute(sql`DELETE FROM attendance_logs WHERE user_id = ${targetId}`);
    console.log("Deleted attendance logs.");

    // Delete vacation requests (user as requester or responder)
    await db.execute(sql`DELETE FROM vacation_requests WHERE user_id = ${targetId} OR responded_by = ${targetId}`);
    console.log("Deleted vacation requests.");

    // Delete user
    console.log(`Deleting user...`);
    await db.execute(sql`DELETE FROM users WHERE id = ${targetId}`);
    console.log("Deletion complete.");

    process.exit(0);
}

run();
