import "dotenv/config";
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
    console.log("Adding missing columns to Neon DB...");
    try {
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;');
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS company TEXT;');
        await pool.query('ALTER TABLE sites ADD COLUMN IF NOT EXISTS company TEXT;');
        await pool.query('ALTER TABLE sites ADD COLUMN IF NOT EXISTS dbref TEXT;');
        await pool.query('ALTER TABLE departments ADD COLUMN IF NOT EXISTS dbref TEXT;');
        console.log("Columns added successfully!");
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
fix();
