
import { storage } from "../server/storage";
import { format } from "date-fns";

async function run() {
    const cookieJar: any = {};

    async function fetchWithCookie(url: string, options: any = {}) {
        const headers = {
            "Content-Type": "application/json",
            ...options.headers,
            "Cookie": Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')
        };

        const res = await fetch("http://localhost:5000" + url, {
            ...options,
            headers
        });

        // Simple cookie parser
        const setCookie = res.headers.get("set-cookie");
        if (setCookie) {
            const parts = setCookie.split(';');
            const [name, value] = parts[0].split('=');
            cookieJar[name] = value;
        }
        return res;
    }

    console.log("--- Login as Park Sojang (Name Login) ---");
    // User: Park Sojang, Phone: 01033333333 -> Password: 3333
    const loginRes = await fetchWithCookie("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "박소장", password: "3333" })
    });

    if (!loginRes.ok) {
        console.error("Login failed!", await loginRes.text());
        process.exit(1);
    }
    const loginData = await loginRes.json();
    console.log("Login User:", loginData.user.name, loginData.user.role);

    console.log("--- GET /api/auth/me ---");
    const meRes = await fetchWithCookie("/api/auth/me");
    const meData = await meRes.json();
    console.log("Me Role:", meData.user.role);
    console.log("Me SiteId:", meData.user.siteId);

    console.log("--- GET /api/sites ---");
    const sitesRes = await fetchWithCookie("/api/sites");
    const sites = await sitesRes.json();
    console.log(`Sites found: ${sites.length}`);
    console.log("Sites:", sites.map((s: any) => s.name));

    const mySite = sites.find((s: any) => s.id === meData.user.siteId);
    if (mySite) {
        console.log("PASS: Site found.");
    } else {
        console.error("FAIL: Site NOT found.");
    }
}

run().catch(console.error);
