/**
 * Standalone script to push database schema directly using raw SQL.
 * This bypasses drizzle-kit's interactive prompts.
 * Usage: npx tsx script/push-schema.ts
 */
import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function pushSchema() {
    console.log("Starting database schema push...");

    try {
        // Create enums if they don't exist
        await pool.query(`
      DO $$ BEGIN
        CREATE TYPE role AS ENUM ('hq_admin', 'site_manager', 'worker');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        console.log("✓ role enum");

        await pool.query(`
      DO $$ BEGIN
        CREATE TYPE attendance_type AS ENUM ('normal', 'annual', 'half_day', 'sick', 'family_event', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        console.log("✓ attendance_type enum");

        await pool.query(`
      DO $$ BEGIN
        CREATE TYPE attendance_source AS ENUM ('qr', 'manual', 'vacation');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        console.log("✓ attendance_source enum");

        await pool.query(`
      DO $$ BEGIN
        CREATE TYPE vacation_status AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        console.log("✓ vacation_status enum");

        await pool.query(`
      DO $$ BEGIN
        CREATE TYPE vacation_type AS ENUM ('annual', 'half_day', 'sick', 'family_event', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        console.log("✓ vacation_type enum");

        // Create tables if they don't exist (order matters for foreign keys)
        await pool.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        address TEXT,
        contract_start_date DATE,
        contract_end_date DATE,
        qr_code TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true
      );
    `);
        console.log("✓ sites table");

        await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id VARCHAR NOT NULL REFERENCES sites(id),
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true
      );
    `);
        console.log("✓ departments table");

        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role role NOT NULL DEFAULT 'worker',
        phone TEXT,
        site_id VARCHAR,
        department_id VARCHAR,
        hire_date DATE,
        is_active BOOLEAN NOT NULL DEFAULT true
      );
    `);
        console.log("✓ users table");

        await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        site_id VARCHAR NOT NULL REFERENCES sites(id),
        check_in_time TIMESTAMP NOT NULL DEFAULT NOW(),
        check_in_date DATE NOT NULL,
        latitude TEXT,
        longitude TEXT,
        attendance_type attendance_type NOT NULL DEFAULT 'normal',
        source attendance_source NOT NULL DEFAULT 'qr',
        vacation_request_id VARCHAR
      );
    `);
        console.log("✓ attendance_logs table");

        await pool.query(`
      CREATE TABLE IF NOT EXISTS vacation_requests (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        vacation_type vacation_type NOT NULL DEFAULT 'annual',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days INTEGER NOT NULL DEFAULT 1,
        reason TEXT,
        substitute_work TEXT NOT NULL DEFAULT 'X',
        status vacation_status NOT NULL DEFAULT 'pending',
        requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
        responded_at TIMESTAMP,
        responded_by VARCHAR REFERENCES users(id),
        rejection_reason TEXT
      );
    `);
        console.log("✓ vacation_requests table");

        // Create session table for connect-pg-simple
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
        console.log("✓ session table");

        console.log("\n✅ Database schema push complete!");
    } catch (error) {
        console.error("❌ Error pushing schema:", error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

pushSchema();
