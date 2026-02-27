import "dotenv/config";
import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkLogin() {
    try {
        console.log("Checking Neon DB specifically for users imported from Excel...");

        // 엑셀에서 import한 사용자 (예: 김철수) 확인
        const workerRes = await pool.query(`SELECT id, username, name, role, site_id FROM users WHERE name = '김철수' LIMIT 1`);
        const worker = workerRes.rows[0];

        if (!worker) {
            console.log("Worker not found. Try another name.");
            return;
        }

        console.log(`\nWorker found:`, worker);
        console.log(`-- Worker's username in DB is: '${worker.username}'`);
        console.log(`-- Worker's name in DB is: '${worker.name}'`);

        // 로그인 라우트 로직 시뮬레이션
        // "배정 환경에서 엑셀로 등록된 인원들이 근로자 모드에서 로그인하면 미배정으로 뜨는데"
        // 엑셀로 업로드된 사용자는 username 과 name 이 동일합니다.
        console.log(`\n[Login simulation for username '${worker.username}']`);

        // condition in /api/auth/login
        let effectiveRole = worker.role;
        if (worker.role === "site_manager" && worker.username !== worker.name) {
            // wait, the actual code is: matchedUser.role === "site_manager" && matchedUser.username !== username
            // If they entered their NAME to login:
            effectiveRole = "worker";
        }

        console.log(`Assigned effectiveRole: ${effectiveRole}`);
        console.log(`Assigned req.session.siteId: ${worker.site_id || undefined}`);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
checkLogin();
