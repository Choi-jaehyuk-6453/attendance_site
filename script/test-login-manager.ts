
import fetch from "node-fetch";

async function login(username, password) {
    const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    console.log(`Login as '${username}': Status ${res.status}`, data.user ? `Role: ${data.user.role}` : data.error);
}

async function main() {
    console.log("--- Testing Site Manager Login ---");
    // 1. Login with Site ID (Username) -> Expect 'site_manager'
    await login("TestSiteLogin", "1234");

    // 2. Login with Name -> Expect 'worker'
    await login("ManagerKim", "1234");
}

main().catch(console.error);
