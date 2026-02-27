import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const connectionString = "postgresql://neondb_owner:npg_5RVTity0ousz@ep-lively-pond-aiu5i8lg-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";
const pool = new Pool({ connectionString });

async function createKoreanAdmin() {
    try {
        const check = await pool.query(`SELECT id FROM users WHERE username = '관리자'`);
        if (check.rows.length === 0) {
            const hashedPassword = await bcrypt.hash("admin123", 10);
            await pool.query(`
        INSERT INTO users (id, username, password, name, role, is_active)
        VALUES (gen_random_uuid(), '관리자', $1, '관리자', 'hq_admin', true)
      `, [hashedPassword]);
            console.log("Successfully created user '관리자' with password 'admin123'.");
        } else {
            console.log("User '관리자' already exists.");
        }
    } catch (error) {
        console.error("Error creating user:", error);
    } finally {
        await pool.end();
    }
}

createKoreanAdmin();
