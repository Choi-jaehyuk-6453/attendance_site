import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verifySitesQuery() {
    try {
        console.log("Checking Neon DB directly...");

        // 1. Pick a worker created by Excel
        const workerRes = await pool.query(`SELECT id, name, role, site_id, company FROM users LIMIT 10`);
        const workers = workerRes.rows.filter(w => w.role === 'worker');

        if (workers.length === 0) {
            console.log("No workers found.");
            return;
        }

        const worker = workers[0];
        console.log("Worker:", worker);

        // 2. Run the exact query /api/sites runs
        console.log(`\nSimulating /api/sites array map for worker...`);
        const sitesRes = await pool.query(`SELECT id, name, is_active FROM sites`);
        let sites = sitesRes.rows;

        // "else if ((currentUser?.role === "site_manager" || currentUser?.role === "worker") && currentUser.site_id)"
        if ((worker.role === "site_manager" || worker.role === "worker") && worker.site_id) {
            sites = sites.filter(s => s.id === worker.site_id);
        } else {
            sites = [];
        }

        console.log("Returned sites for this worker:", sites);

        if (sites.length === 0) {
            console.log("AH! The worker's site ID doesn't match any active site.");
            const siteCheck = await pool.query(`SELECT id, name FROM sites WHERE id = $1`, [worker.site_id]);
            console.log("Does the site exist at all?", siteCheck.rows);
        } else {
            console.log("Site matched successfully. It should show on the frontend.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
verifySitesQuery();
