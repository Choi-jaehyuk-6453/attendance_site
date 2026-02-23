import { Pool } from "pg";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    console.log("Dropping all tables...");

    const client = await pool.connect();
    try {
        // Drop all tables in public schema
        await client.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);
        console.log("All tables dropped successfully.");
    } catch (err) {
        console.error("Error dropping tables:", err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
