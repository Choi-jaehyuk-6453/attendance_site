import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    // Check all workers for 정화빌딩
    const siteId = 'ca5f7c98-07cb-44c6-8556-ec47bc7ff62f';

    const r = await pool.query(
        `SELECT id, username, name, role, phone, site_id, is_active, company FROM public.users WHERE site_id = $1 ORDER BY role, name`,
        [siteId]
    );
    console.log(`Users for 정화빌딩 (${r.rows.length} total):`);
    for (const row of r.rows) {
        console.log(`  [${row.role}] ${row.name} (username=${row.username}, active=${row.is_active}, company=${row.company})`);
    }

    // Also check for workers with no siteId
    const r2 = await pool.query(
        `SELECT id, username, name, role, phone, site_id, company FROM public.users WHERE role = 'worker' AND site_id IS NULL`
    );
    console.log(`\nWorkers with no siteId: ${r2.rows.length}`);
    for (const row of r2.rows) {
        console.log(`  ${row.name} (company=${row.company})`);
    }

    // Check all sites and worker counts
    const r3 = await pool.query(`
    SELECT s.name as site_name, s.id as site_id, 
      COUNT(CASE WHEN u.role = 'worker' AND u.is_active = true THEN 1 END) as worker_count,
      COUNT(CASE WHEN u.role = 'site_manager' AND u.is_active = true THEN 1 END) as manager_count
    FROM public.sites s
    LEFT JOIN public.users u ON u.site_id = s.id
    WHERE s.is_active = true
    GROUP BY s.name, s.id
    ORDER BY s.name
  `);
    console.log('\nSite summary:');
    for (const row of r3.rows) {
        console.log(`  ${row.site_name}: ${row.worker_count} workers, ${row.manager_count} managers`);
    }

    await pool.end();
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
