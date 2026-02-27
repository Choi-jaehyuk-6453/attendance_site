import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";
import { neonConfig } from "@neondatabase/serverless";
import * as schema from "../shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function debugExcelWorker() {
    try {
        console.log("Using DATABASE_URL:", process.env.DATABASE_URL?.split('@')[1]);

        // 1. Get any site
        const siteCheck = await pool.query(`SELECT id, name, company FROM sites LIMIT 1`);
        if (siteCheck.rows.length === 0) {
            console.log("No sites found. Cannot test.");
            return;
        }
        const site = siteCheck.rows[0];
        console.log("Found site:", site);

        // 2. Simulate Excel worker creation
        const phone = "010-9999-5555";
        const name = "엑셀테스트";
        const password = await bcrypt.hash("5555", 10);

        const checkUser = await pool.query(`SELECT id FROM users WHERE username = $1 AND phone = $2`, [name, phone]);
        if (checkUser.rows.length === 0) {
            console.log("Creating test worker...");
            await pool.query(`
                INSERT INTO users (username, password, name, role, phone, site_id, company)
                VALUES ($1, $2, $3, 'worker', $4, $5, $6)
            `, [name, password, name, phone, site.id, site.company]);
        }

        // 3. Fetch the created worker and check fields
        const workerRes = await pool.query(`SELECT id, name, role, site_id, company FROM users WHERE username = '엑셀테스트'`);
        const worker = workerRes.rows[0];
        console.log("Worker stored in DB:", worker);

        // If site_id is fine, we know storage is fine.
        console.log(`\nTo test frontend '미배정' bug:`);
        console.log(`Log in as 아이디: 엑셀테스트 / 비번: 5555`);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
debugExcelWorker();
