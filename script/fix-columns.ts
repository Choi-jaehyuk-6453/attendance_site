/**
 * Fix missing columns in existing tables.
 * Adds columns that were defined in schema.ts but missing from pre-existing tables.
 */
import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixColumns() {
    console.log("Checking and adding missing columns...\n");

    const alterStatements = [
        // users table - possible missing columns
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id VARCHAR`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS site_id VARCHAR`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`,
        // attendance_logs - possible missing columns
        `ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS vacation_request_id VARCHAR`,
        `ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS latitude TEXT`,
        `ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS longitude TEXT`,
        // vacation_requests - possible missing columns
        `ALTER TABLE vacation_requests ADD COLUMN IF NOT EXISTS days INTEGER NOT NULL DEFAULT 1`,
        `ALTER TABLE vacation_requests ADD COLUMN IF NOT EXISTS substitute_work TEXT NOT NULL DEFAULT 'X'`,
        `ALTER TABLE vacation_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT`,
    ];

    for (const stmt of alterStatements) {
        try {
            await pool.query(stmt);
            console.log(`✓ ${stmt.substring(0, 80)}...`);
        } catch (error: any) {
            if (error.code === '42701') {
                // column already exists - that's fine
                console.log(`- already exists: ${stmt.substring(0, 60)}...`);
            } else {
                console.error(`✗ Error: ${error.message} — ${stmt}`);
            }
        }
    }

    // Also check that admin user exists
    const adminCheck = await pool.query(`SELECT id, username, role FROM users WHERE role = 'hq_admin' LIMIT 1`);
    if (adminCheck.rows.length === 0) {
        console.log("\n⚠ No admin user found in database. You may need to create one.");
    } else {
        console.log(`\n✓ Admin user exists: ${adminCheck.rows[0].username} (id: ${adminCheck.rows[0].id})`);
    }

    console.log("\n✅ Column fix complete!");
    await pool.end();
}

fixColumns().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
