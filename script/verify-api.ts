
const BASE_URL = 'http://localhost:5000';
let cookie = '';

async function request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;

    const options = {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    };

    const res = await fetch(`${BASE_URL}${path}`, options);

    // Extract cookie from login response
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
        cookie = setCookie.split(';')[0]; // Simple extraction
    }

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${errorText}`);
    }

    if (res.status === 204) return null;
    return res.json();
}

async function runVerification() {
    try {
        console.log("1. Logging in as admin...");
        await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
        console.log("✓ Logged in");

        console.log("\n2. Creating Site (Company: dawon_pmc)...");
        const site = await request('POST', '/api/sites', {
            name: 'TestSiteVerify',
            company: 'dawon_pmc',
            address: 'Test Address'
        });
        console.log(`✓ Created Site: ${site.name} (ID: ${site.id}, Company: ${site.company})`);

        console.log("\n3. Creating Site Manager...");
        const manager = await request('POST', '/api/site-managers', {
            name: 'TestManagerVerify',
            phone: '010-9999-8888',
            siteId: site.id
        });
        console.log(`✓ Created Manager: ${manager.username}, Role: ${manager.role}`);

        console.log("\n4. Updating Site (Company: mirae_abm)...");
        const updatedSite = await request('PATCH', `/api/sites/${site.id}`, {
            name: 'TestSiteVerifyUpdated',
            company: 'mirae_abm'
        });
        console.log(`✓ Updated Site: ${updatedSite.name} (Company: ${updatedSite.company})`);

        console.log("\n5. Verifying in List...");
        const sitesList = await request('GET', '/api/sites');
        const foundSite = sitesList.find(s => s.id === site.id);

        if (foundSite && foundSite.company === 'mirae_abm' && foundSite.name === 'TestSiteVerifyUpdated') {
            console.log("✓ Verification Successful: Site found in list with correct data.");
        } else {
            console.error("❌ Verification Failed: Site not found or incorrect data in list.");
            console.log("Found:", foundSite);
        }

        // Cleanup
        console.log("\n6. Cleaning up...");
        await request('DELETE', `/api/users/${manager.id}`);
        await request('DELETE', `/api/sites/${site.id}`); // Deletes site
        console.log("✓ Cleanup complete");

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

runVerification();
