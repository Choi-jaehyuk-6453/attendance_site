import "dotenv/config";
import { pool } from "./server/db";

async function main() {
    try {
        console.log("Adding 'resigned' to attendance_type enum if not exists...");
        await pool.query("ALTER TYPE attendance_type ADD VALUE IF NOT EXISTS 'resigned'");
        console.log("Successfully added 'resigned'");
    } catch (err) {
        console.error("Error adding enum value:", err);
    } finally {
        pool.end();
    }
}

main();
