/**
 * Fix enum types that have old values from a previous project.
 * Properly handles column defaults before dropping enums.
 */
import pg from "pg";
import bcrypt from "bcryptjs";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixEnumsAndSeedAdmin() {
    console.log("Fixing enum types...\n");

    // Check current enum values
    const enumCheck = await pool.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname IN ('role', 'attendance_type', 'attendance_source', 'vacation_status', 'vacation_type')
    ORDER BY t.typname, e.enumsortorder
  `);

    console.log("Current enum values:");
    const enumMap: Record<string, string[]> = {};
    for (const row of enumCheck.rows) {
        if (!enumMap[row.typname]) enumMap[row.typname] = [];
        enumMap[row.typname].push(row.enumlabel);
    }
    for (const [name, values] of Object.entries(enumMap)) {
        console.log(`  ${name}: [${values.join(', ')}]`);
    }

    // Expected enum values
    const expectedEnums: Record<string, string[]> = {
        role: ['hq_admin', 'site_manager', 'worker'],
        attendance_type: ['normal', 'annual', 'half_day', 'sick', 'family_event', 'other'],
        attendance_source: ['qr', 'manual', 'vacation'],
        vacation_status: ['pending', 'approved', 'rejected'],
        vacation_type: ['annual', 'half_day', 'sick', 'family_event', 'other'],
    };

    for (const [enumName, expectedValues] of Object.entries(expectedEnums)) {
        const currentValues = enumMap[enumName] || [];
        const isCorrect = expectedValues.every(v => currentValues.includes(v)) && currentValues.length === expectedValues.length;

        if (!isCorrect) {
            console.log(`\nFixing ${enumName} enum...`);

            // Find tables/columns using this enum
            const usageCheck = await pool.query(`
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        WHERE c.udt_name = $1
        AND c.table_schema = 'public'
      `, [enumName]);

            // Drop column defaults and alter columns to text temporarily
            for (const usage of usageCheck.rows) {
                await pool.query(`ALTER TABLE "${usage.table_name}" ALTER COLUMN "${usage.column_name}" DROP DEFAULT`);
                await pool.query(`ALTER TABLE "${usage.table_name}" ALTER COLUMN "${usage.column_name}" TYPE TEXT`);
                console.log(`  → Changed ${usage.table_name}.${usage.column_name} to TEXT (dropped default)`);
            }

            // Drop old enum and recreate
            await pool.query(`DROP TYPE IF EXISTS "${enumName}" CASCADE`);
            const valuesStr = expectedValues.map(v => `'${v}'`).join(', ');
            await pool.query(`CREATE TYPE "${enumName}" AS ENUM (${valuesStr})`);
            console.log(`  → Recreated ${enumName} enum with values: [${expectedValues.join(', ')}]`);

            // Clean up invalid data and change columns back to enum type
            for (const usage of usageCheck.rows) {
                const validValuesStr = expectedValues.map(v => `'${v}'`).join(', ');
                // Nullify invalid values instead of deleting rows
                await pool.query(`UPDATE "${usage.table_name}" SET "${usage.column_name}" = NULL WHERE "${usage.column_name}" NOT IN (${validValuesStr}) AND "${usage.column_name}" IS NOT NULL`);

                // For non-nullable columns, set a default value
                const notNullable = await pool.query(`
          SELECT is_nullable FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = $2
        `, [usage.table_name, usage.column_name]);

                if (notNullable.rows[0]?.is_nullable === 'NO') {
                    // Set null values to first expected value
                    await pool.query(`UPDATE "${usage.table_name}" SET "${usage.column_name}" = '${expectedValues[0]}' WHERE "${usage.column_name}" IS NULL`);
                }

                await pool.query(`ALTER TABLE "${usage.table_name}" ALTER COLUMN "${usage.column_name}" TYPE "${enumName}" USING "${usage.column_name}"::"${enumName}"`);
                console.log(`  → Changed ${usage.table_name}.${usage.column_name} back to ${enumName} enum`);
            }

            // Restore defaults based on schema
            const defaults: Record<string, Record<string, string>> = {
                role: { 'users.role': "'worker'" },
                attendance_type: { 'attendance_logs.attendance_type': "'normal'" },
                attendance_source: { 'attendance_logs.source': "'qr'" },
                vacation_status: { 'vacation_requests.status': "'pending'" },
                vacation_type: { 'vacation_requests.vacation_type': "'annual'" },
            };

            if (defaults[enumName]) {
                for (const [tableCol, defaultVal] of Object.entries(defaults[enumName])) {
                    const [table, col] = tableCol.split('.');
                    await pool.query(`ALTER TABLE "${table}" ALTER COLUMN "${col}" SET DEFAULT ${defaultVal}::"${enumName}"`);
                    console.log(`  → Restored default for ${tableCol} = ${defaultVal}`);
                }
            }

            console.log(`  ✓ ${enumName} fixed!`);
        } else {
            console.log(`\n✓ ${enumName} is correct`);
        }
    }

    // Seed admin user if not exists
    console.log("\nChecking for admin user...");
    const adminCheck = await pool.query(`SELECT id, username FROM users WHERE role = 'hq_admin' LIMIT 1`);

    if (adminCheck.rows.length === 0) {
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await pool.query(`
      INSERT INTO users (id, username, password, name, role, is_active)
      VALUES (gen_random_uuid(), 'admin', $1, '본사관리자', 'hq_admin', true)
    `, [hashedPassword]);
        console.log("✓ Created admin user: username='admin', password='admin123'");
    } else {
        console.log(`✓ Admin user already exists: ${adminCheck.rows[0].username}`);
    }

    console.log("\n✅ All fixes complete!");
    await pool.end();
}

fixEnumsAndSeedAdmin().catch(err => {
    console.error("Fatal error:", err);
    pool.end();
    process.exit(1);
});
