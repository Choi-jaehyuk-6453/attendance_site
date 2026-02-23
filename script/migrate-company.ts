/**
 * Migration script to add 'company' enum and column to 'sites' table.
 */
import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateCompany() {
    console.log("Starting company migration...");

    try {
        // 1. Create company enum
        await pool.query(`
      DO $$ BEGIN
        CREATE TYPE company AS ENUM ('mirae_abm', 'dawon_pmc');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        console.log("✓ company enum created (or already exists)");

        // 2. Add company column to sites table
        // We add it as nullable first, fill with default, then set not null to handle existing rows safely
        await pool.query(`
      ALTER TABLE sites 
      ADD COLUMN IF NOT EXISTS company company DEFAULT 'mirae_abm'
    `);
        console.log("✓ company column added to sites table");

        // 3. Ensure it's not null (the DEFAULT above handles new inserts, but let's be sure for existing rows)
        await pool.query(`
      UPDATE sites SET company = 'mirae_abm' WHERE company IS NULL
    `);
        await pool.query(`
      ALTER TABLE sites ALTER COLUMN company SET NOT NULL
    `);
        console.log("✓ company column set to NOT NULL with default 'mirae_abm'");

        console.log("\n✅ Migration complete!");
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrateCompany();
