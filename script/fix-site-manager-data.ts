import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    // Fix: site manager 최재혁 for 정화빌딩 has wrong username
    // Should be 정화빌딩 (site name) not 최재혁 (person name)
    const siteId = 'ca5f7c98-07cb-44c6-8556-ec47bc7ff62f';
    const managerId = '84a68d6e-355f-4755-9377-935ab38bc7d5';

    const result = await pool.query(
        `UPDATE public.users SET username = $1 WHERE id = $2 RETURNING id, username, name, role, phone`,
        ['정화빌딩', managerId]
    );

    if (result.rows.length > 0) {
        console.log('Fixed site manager username:', JSON.stringify(result.rows[0]));
    } else {
        console.log('No rows updated - manager not found');
    }

    // Verify: list all site managers for 정화빌딩
    const verify = await pool.query(
        `SELECT id, username, name, role, phone, site_id FROM public.users WHERE site_id = $1 AND role = 'site_manager'`,
        [siteId]
    );
    console.log('\nSite managers for 정화빌딩 after fix:');
    for (const row of verify.rows) {
        const last4 = row.phone.replace(/\D/g, '').slice(-4);
        console.log(`  ${row.name}: username=${row.username}, phone=${row.phone}, password(last4)=${last4}`);
    }

    await pool.end();
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
