import { pool } from './server/db.js';
async function test() {
    try {
        const res = await pool.query(`SELECT id, username, name, role, is_active FROM users WHERE role IN ('hq_admin', 'site_manager')`);
        console.log("Admins/Managers:", res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
