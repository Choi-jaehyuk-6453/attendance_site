

const API_URL = "http://localhost:5000";

async function verifyExcelUpload() {
    console.log("1. Logging in as Admin to perform import...");
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "password" }) // Try default admin
    });

    if (!loginRes.ok) {
        // fallback if password is changed, maybe admin123?
        const loginRes2 = await fetch(`${API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "관리자", password: "admin123" })
        });
        if (!loginRes2.ok) {
            console.error("Failed to login as admin to test upload.");
            return;
        } else {
            console.log("Logged in as 관리자");
        }
    } else {
        console.log("Logged in as admin");
    }

    // Get session cookie
    const getCookies = (res: any) => {
        const setCookie = res.headers.get('set-cookie');
        if (!setCookie) return '';
        return setCookie.split(',').map((c: string) => c.split(';')[0]).join(';');
    };
    const cookie = getCookies(loginRes.ok ? loginRes : await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "관리자", password: "admin123" })
    }));

    // Fetch sites
    console.log("2. Fetching sites...");
    const sitesRes = await fetch(`${API_URL}/api/sites`, { headers: { Cookie: cookie } });
    const sites = await sitesRes.json();
    if (!sites || sites.length === 0) {
        console.error("No sites found. Create a site first.");
        return;
    }
    const siteId = sites[0].id;

    console.log(`Using site: ${sites[0].name} (${siteId})`);

    // Simulate Bulk Import
    console.log("3. Simulating Bulk Import...");
    const testWorker = {
        name: `테스트근로자_${Date.now()}`,
        phone: "010-9999-1234",
        department: "테스트부서",
        jobTitle: "사원",
        hireDate: "2026-02-23",
    };

    const importRes = await fetch(`${API_URL}/api/workers/bulk-import`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Cookie: cookie,
        },
        body: JSON.stringify({
            siteId,
            data: [testWorker],
        }),
    });

    const importResult = await importRes.json();
    console.log("Import Result:", importResult);

    if (importResult.success !== 1) {
        console.error("Worker import failed.");
        return;
    }

    // Test Worker Login
    console.log("4. Testing Worker Login...");
    // Username is name, password should be last 4 digits "1234"
    const workerLoginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: testWorker.name, password: "1234" }),
    });

    const workerLoginResult = await workerLoginRes.json();
    if (workerLoginRes.ok) {
        console.log("✅ Worker Login SUCCESS!", workerLoginResult.user);
        console.log("Generated Password check: PASS");
    } else {
        console.error("❌ Worker Login FAILED!", workerLoginResult);
    }
}

verifyExcelUpload();
