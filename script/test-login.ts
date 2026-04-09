import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

async function testLogin() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000 
  });

  try {
    console.log("=== 비밀번호 검증 테스트 ===\n");

    // 1. HQ Admin 테스트
    console.log("--- HQ Admin ---");
    const admins = await pool.query(
      `SELECT id, username, name, role, password FROM users WHERE role = 'hq_admin'`
    );
    for (const u of admins.rows) {
      const testPasswords = ["admin123", "1234", "admin"];
      for (const pw of testPasswords) {
        const ok = await bcrypt.compare(pw, u.password);
        if (ok) console.log(`  ✅ ${u.username}(${u.name}): password='${pw}' 일치!`);
      }
      // Check if any matched
      const anyMatch = await Promise.all(testPasswords.map(pw => bcrypt.compare(pw, u.password)));
      if (!anyMatch.some(Boolean)) {
        console.log(`  ❌ ${u.username}(${u.name}): 테스트한 비밀번호 중 일치하는 것 없음`);
        console.log(`     hash: ${u.password.substring(0, 20)}...`);
      }
    }

    // 2. Site Manager 테스트
    console.log("\n--- Site Manager ---");
    const managers = await pool.query(
      `SELECT id, username, name, role, password, phone FROM users WHERE role = 'site_manager' LIMIT 5`
    );
    for (const u of managers.rows) {
      const cleanPhone = (u.phone || "").replace(/\D/g, "");
      const last4 = cleanPhone.slice(-4);
      if (last4.length === 4) {
        const ok = await bcrypt.compare(last4, u.password);
        console.log(`  ${ok ? "✅" : "❌"} ${u.username}(${u.name}): phone=${u.phone}, last4=${last4}, match=${ok}`);
      } else {
        console.log(`  ⚠️ ${u.username}(${u.name}): phone=${u.phone} - 4자리 추출 불가`);
      }
    }

    // 3. Worker 테스트
    console.log("\n--- Worker (샘플 5명) ---");
    const workers = await pool.query(
      `SELECT id, username, name, role, password, phone FROM users WHERE role = 'worker' AND is_active = true LIMIT 5`
    );
    for (const u of workers.rows) {
      const cleanPhone = (u.phone || "").replace(/\D/g, "");
      const last4 = cleanPhone.slice(-4);
      if (last4.length === 4) {
        const ok = await bcrypt.compare(last4, u.password);
        console.log(`  ${ok ? "✅" : "❌"} ${u.username}(${u.name}): phone=${u.phone}, last4=${last4}, match=${ok}`);
      } else {
        console.log(`  ⚠️ ${u.username}(${u.name}): phone=${u.phone} - 4자리 추출 불가`);
      }
    }

    // 4. 서버 실행 여부와 상관없이 로그인 로직 시뮬레이션
    console.log("\n=== 로그인 로직 시뮬레이션 ===");
    
    // 관리자 로그인 시뮬레이션
    const testUsername = "관리자";
    console.log(`\n간리자 로그인 시도: username='${testUsername}'`);
    const matchResult = await pool.query(
      `SELECT id, username, name, role, password, is_active, site_id FROM users 
       WHERE (username = $1 OR name = $1) AND is_active = true`,
      [testUsername]
    );
    console.log(`  매칭된 사용자 수: ${matchResult.rows.length}`);
    for (const u of matchResult.rows) {
      console.log(`  - ${u.username}(${u.name}), role=${u.role}, site_id=${u.site_id}`);
    }

  } catch (e: any) {
    console.error("오류:", e.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testLogin();
