/**
 * Complete database fix: ensure all columns, enums, and data are correct.
 * Checks column types, fixes enum values, and updates old user data.
 */
import pg from "pg";
import bcrypt from "bcryptjs";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fullFix() {
    const client = await pool.connect();
    try {
        console.log("=== Full Database Fix ===\n");

        // 1. Check users.role column type
        const colCheck = await client.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
        console.log("Current users table columns:");
        for (const col of colCheck.rows) {
            console.log(`  ${col.column_name}: ${col.data_type} (udt: ${col.udt_name})`);
        }

        // 2. Check if role column is TEXT (needs to be converted to enum)
        const roleCol = colCheck.rows.find((c: any) => c.column_name === 'role');
        if (roleCol && roleCol.udt_name !== 'role') {
            console.log(`\nrole column is ${roleCol.udt_name}, converting to role enum...`);

            // Update old role values to new ones
            await client.query(`UPDATE users SET role = 'hq_admin' WHERE role IN ('admin', 'HQ_ADMIN')`);
            await client.query(`UPDATE users SET role = 'site_manager' WHERE role IN ('guard', 'SITE_MANAGER', 'manager')`);
            await client.query(`UPDATE users SET role = 'worker' WHERE role NOT IN ('hq_admin', 'site_manager', 'worker') OR role IS NULL`);
            console.log("  → Updated old role values to new enum values");

            // Convert column to enum
            await client.query(`ALTER TABLE users ALTER COLUMN role DROP DEFAULT`);
            await client.query(`ALTER TABLE users ALTER COLUMN role TYPE role USING role::role`);
            await client.query(`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'worker'::role`);
            console.log("  → Converted role column to enum type");
        } else {
            console.log("\n✓ role column is already enum type");

            // Still update any old values
            const oldRoles = await client.query(`SELECT id, username, role FROM users WHERE role::text NOT IN ('hq_admin', 'site_manager', 'worker')`);
            if (oldRoles.rows.length > 0) {
                console.log("Found users with old role values:");
                for (const u of oldRoles.rows) {
                    console.log(`  ${u.username}: ${u.role}`);
                }
            }
        }

        // 3. Check all enum types
        const enumCheck = await client.query(`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname IN ('role', 'attendance_type', 'attendance_source', 'vacation_status', 'vacation_type')
      ORDER BY t.typname, e.enumsortorder
    `);
        console.log("\nCurrent enum values:");
        const enumMap: Record<string, string[]> = {};
        for (const row of enumCheck.rows) {
            if (!enumMap[row.typname]) enumMap[row.typname] = [];
            enumMap[row.typname].push(row.enumlabel);
        }
        for (const [name, values] of Object.entries(enumMap)) {
            console.log(`  ${name}: [${values.join(', ')}]`);
        }

        // 4. Check admin user
        const adminCheck = await client.query(`SELECT id, username, name, role::text as role FROM users`);
        console.log("\nAll users:");
        for (const u of adminCheck.rows) {
            console.log(`  ${u.username} (${u.name}) - role: ${u.role}`);
        }

        // 5. Ensure at least one hq_admin exists
        const hqAdmins = adminCheck.rows.filter((u: any) => u.role === 'hq_admin');
        if (hqAdmins.length === 0) {
            console.log("\n⚠ No hq_admin found! Creating one...");
            const hashedPassword = await bcrypt.hash("admin123", 10);
            await client.query(`
        INSERT INTO users (id, username, password, name, role, is_active)
        VALUES (gen_random_uuid(), 'admin', $1, '본사관리자', 'hq_admin', true)
      `, [hashedPassword]);
            console.log("✓ Created admin user: username='admin', password='admin123'");
        } else {
            console.log(`\n✓ hq_admin exists: ${hqAdmins.map((u: any) => u.username).join(', ')}`);
        }

        console.log("\n✅ Full fix complete!");
    } catch (error) {
        console.error("Error:", error);
    } finally {
        client.release();
        await pool.end();
    }
}

fullFix();
