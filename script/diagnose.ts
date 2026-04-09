import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

async function diagnose() {
  const connStr = process.env.DATABASE_URL;
  console.log("=== 1. DATABASE_URL 확인 ===");
  console.log("DATABASE_URL:", connStr);
  
  if (!connStr) {
    console.error("ERROR: DATABASE_URL이 설정되지 않았습니다!");
    process.exit(1);
  }

  // Parse the URL to check components
  try {
    const url = new URL(connStr);
    console.log("  - Host:", url.hostname);
    console.log("  - Port:", url.port);
    console.log("  - User:", url.username);
    console.log("  - Password:", url.password);
    console.log("  - Database:", url.pathname);
  } catch (e) {
    console.error("URL 파싱 실패:", e);
  }

  console.log("\n=== 2. DB 연결 테스트 ===");
  const pool = new Pool({ 
    connectionString: connStr,
    connectionTimeoutMillis: 15000 
  });

  try {
    const testResult = await pool.query("SELECT 1 as test");
    console.log("✅ DB 연결 성공!");
  } catch (e: any) {
    console.error("❌ DB 연결 실패:", e.message);
    await pool.end();
    process.exit(1);
  }

  console.log("\n=== 3. Enum 타입 확인 ===");
  try {
    const enums = await pool.query(`
      SELECT t.typname, e.enumlabel 
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      ORDER BY t.typname, e.enumsortorder
    `);
    const enumMap: Record<string, string[]> = {};
    for (const row of enums.rows) {
      if (!enumMap[row.typname]) enumMap[row.typname] = [];
      enumMap[row.typname].push(row.enumlabel);
    }
    for (const [name, values] of Object.entries(enumMap)) {
      console.log(`  ${name}: [${values.join(", ")}]`);
    }
  } catch (e: any) {
    console.error("Enum 조회 실패:", e.message);
  }

  console.log("\n=== 4. 테이블 구조 확인 ===");
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log("테이블 목록:", tables.rows.map((r: any) => r.table_name).join(", "));
  } catch (e: any) {
    console.error("테이블 조회 실패:", e.message);
  }

  console.log("\n=== 5. Users 테이블 컬럼 확인 ===");
  try {
    const cols = await pool.query(`
      SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    for (const col of cols.rows) {
      console.log(`  ${col.column_name}: ${col.udt_name} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
    }
  } catch (e: any) {
    console.error("컬럼 조회 실패:", e.message);
  }

  console.log("\n=== 6. 사용자 데이터 확인 ===");
  try {
    const allUsers = await pool.query(`
      SELECT id, username, name, role, is_active, company, site_id, phone
      FROM users
      ORDER BY role, name
    `);
    console.log(`총 사용자 수: ${allUsers.rows.length}`);
    console.log("\n--- 관리자 (hq_admin) ---");
    const admins = allUsers.rows.filter((r: any) => r.role === "hq_admin");
    for (const u of admins) {
      console.log(`  [${u.is_active ? "활성" : "비활성"}] ID=${u.id}, username=${u.username}, name=${u.name}, company=${u.company}`);
    }
    console.log("\n--- 현장관리자 (site_manager) ---");
    const managers = allUsers.rows.filter((r: any) => r.role === "site_manager");
    for (const u of managers) {
      console.log(`  [${u.is_active ? "활성" : "비활성"}] ID=${u.id}, username=${u.username}, name=${u.name}, site_id=${u.site_id}, company=${u.company}`);
    }
    console.log("\n--- 근로자 (worker) 요약 ---");
    const workers = allUsers.rows.filter((r: any) => r.role === "worker");
    const activeWorkers = workers.filter((w: any) => w.is_active);
    console.log(`  전체: ${workers.length}명, 활성: ${activeWorkers.length}명`);
    if (workers.length > 0) {
      console.log("  첫 3명 샘플:");
      for (const u of workers.slice(0, 3)) {
        console.log(`    [${u.is_active ? "활성" : "비활성"}] username=${u.username}, name=${u.name}, site_id=${u.site_id}, company=${u.company}`);
      }
    }

    // Check for users with unexpected role values
    const unknownRole = allUsers.rows.filter((r: any) => !["hq_admin", "site_manager", "worker"].includes(r.role));
    if (unknownRole.length > 0) {
      console.log("\n⚠️ 알 수 없는 role을 가진 사용자:");
      for (const u of unknownRole) {
        console.log(`  ID=${u.id}, username=${u.username}, role=${u.role}`);
      }
    }
  } catch (e: any) {
    console.error("사용자 조회 실패:", e.message);
  }

  console.log("\n=== 7. Sites 테이블 확인 ===");
  try {
    const allSites = await pool.query(`
      SELECT id, name, is_active, company
      FROM sites
      ORDER BY company, name
    `);
    console.log(`총 사이트 수: ${allSites.rows.length}`);
    for (const s of allSites.rows) {
      console.log(`  [${s.is_active ? "활성" : "비활성"}] ID=${s.id}, name=${s.name}, company=${s.company}`);
    }
  } catch (e: any) {
    console.error("사이트 조회 실패:", e.message);
  }

  console.log("\n=== 8. 비밀번호 해시 확인 (첫 번째 관리자) ===");
  try {
    const admin = await pool.query(`
      SELECT id, username, password, role FROM users WHERE role = 'hq_admin' LIMIT 1
    `);
    if (admin.rows.length > 0) {
      const pw = admin.rows[0].password;
      console.log(`  username: ${admin.rows[0].username}`);
      console.log(`  password hash 길이: ${pw.length}`);
      console.log(`  password hash starts with: ${pw.substring(0, 10)}...`);
      console.log(`  bcrypt 형식 여부: ${pw.startsWith("$2") ? "✅ Yes" : "❌ No"}`);
    } else {
      console.log("  ⚠️ hq_admin 사용자가 없습니다!");
    }
  } catch (e: any) {
    console.error("비밀번호 조회 실패:", e.message);
  }

  await pool.end();
  console.log("\n=== 진단 완료 ===");
  process.exit(0);
}

diagnose().catch(e => {
  console.error("진단 스크립트 오류:", e);
  process.exit(1);
});
