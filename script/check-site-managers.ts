import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const r = await pool.query(
        `SELECT id, username, name, role, phone, site_id FROM public.users WHERE role = 'site_manager' ORDER BY username`
    );
    console.log('Site managers:');
    for (const row of r.rows) {
        console.log(JSON.stringify(row));
    }

    // Check for any duplicates
    const r2 = await pool.query(
        `SELECT username, COUNT(*) as cnt FROM public.users WHERE role = 'site_manager' GROUP BY username HAVING COUNT(*) > 1`
    );
    console.log('\nDuplicate usernames:', r2.rows.length > 0 ? JSON.stringify(r2.rows) : 'None');

    // Also list sites
    const r3 = await pool.query(`SELECT id, name FROM public.sites WHERE is_active = true ORDER BY name`);
    console.log('\nActive sites:');
    for (const row of r3.rows) {
        console.log(`  ${row.name} (${row.id})`);
    }

    await pool.end();
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
