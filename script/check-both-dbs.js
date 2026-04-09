import pg from 'pg';

async function checkDb(url, name) {
  try {
    const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
    const res = await pool.query('SELECT count(*) FROM users');
    console.log(name, 'connection successful, user count:', res.rows[0].count);
    
    const adminRes = await pool.query('SELECT username FROM users WHERE role = $1', ['hq_admin']);
    console.log(name, 'HQ Admins:', adminRes.rows.map(r => r.username));
    
    await pool.end();
  } catch(e) { 
    console.log(name, 'connection failed:', e.message); 
  }
}

const supabaseUrl = 'postgresql://postgres.ojoeyajhvpuedydnlheo:dkflfkd12!%40@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';
const neonUrl = 'postgresql://neondb_owner:npg_5RVTity0ousz@ep-lively-pond-aiu5i8lg-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  await checkDb(supabaseUrl, 'Supabase');
  await checkDb(neonUrl, 'Neon');
  process.exit(0);
}

main();
