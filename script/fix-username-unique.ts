import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    // Check for unique indexes on username
    const r = await pool.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'users'
  `);
    console.log('All indexes on users table:');
    for (const row of r.rows) {
        console.log(`  ${row.indexname}: ${row.indexdef}`);
    }

    // Check for unique constraints
    const r2 = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def 
    FROM pg_constraint 
    WHERE conrelid = 'users'::regclass
  `);
    console.log('\nAll constraints on users table:');
    for (const row of r2.rows) {
        console.log(`  ${row.conname} (type=${row.contype}): ${row.def}`);
    }

    // Drop unique indexes on username (not the PK)
    const usernameIndexes = r.rows.filter(
        (row: any) => row.indexdef.includes('username') && row.indexdef.includes('UNIQUE')
    );

    if (usernameIndexes.length > 0) {
        for (const idx of usernameIndexes) {
            console.log(`\nDropping unique index: ${idx.indexname}`);
            await pool.query(`DROP INDEX IF EXISTS "${idx.indexname}"`);
            console.log(`  Dropped!`);
        }
    } else {
        console.log('\nNo unique index found on username column.');
    }

    // Also check and drop unique constraints (not indexes) on username
    const usernameConstraints = r2.rows.filter(
        (row: any) => row.contype === 'u' && row.def.includes('username')
    );

    if (usernameConstraints.length > 0) {
        for (const con of usernameConstraints) {
            console.log(`\nDropping unique constraint: ${con.conname}`);
            await pool.query(`ALTER TABLE users DROP CONSTRAINT "${con.conname}"`);
            console.log(`  Dropped!`);
        }
    } else {
        console.log('No unique constraint found on username column.');
    }

    console.log('\nDone!');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
