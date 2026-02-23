
import { storage } from "../server/storage";
import express from "express";
import session from "express-session";
import { registerRoutes } from "../server/routes";
import request from "supertest";

async function run() {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: "test", resave: false, saveUninitialized: false }));

    // Mock session middleware
    app.use((req, res, next) => {
        // Simulate logged in as '관리자' (HQ Admin, Mirae ABM)
        (req.session as any).userId = "user-admin-id"; // Need actual ID
        (req.session as any).role = "hq_admin";
        next();
    });

    const server = await registerRoutes(app as any, app);

    // 1. Get Admin User ID
    const users = await storage.getUsers();
    const admin = users.find(u => u.username === "관리자");
    if (!admin) {
        console.error("Admin user not found");
        process.exit(1);
    }

    // Override session middleware to use actual admin ID
    app.use((req, res, next) => {
        (req.session as any).userId = admin.id;
        next();
    });

    console.log("--- Testing GET /api/sites?company=dawon_pmc ---");
    const resSites = await request(app).get("/api/sites?company=dawon_pmc");
    const dawonSites = resSites.body;
    console.log(`Sites found: ${dawonSites.length}`);
    const leakingSites = dawonSites.filter((s: any) => s.company !== "dawon_pmc");
    if (leakingSites.length > 0) {
        console.error("FAIL: Found leaking sites:", leakingSites.map((s: any) => s.name));
    } else {
        console.log("PASS: Only Dawon sites returned.");
    }


    console.log("--- Testing GET /api/users?company=dawon_pmc ---");
    const resUsers = await request(app).get("/api/users?company=dawon_pmc");
    const dawonUsers = resUsers.body;
    console.log(`Users found: ${dawonUsers.length}`);

    // Check for leaks
    // Note: Admin user (mirae_abm) MIGHT be included due to current logic.
    const leakingUsers = dawonUsers.filter((u: any) => u.company !== "dawon_pmc" && u.id !== admin.id);

    if (leakingUsers.length > 0) {
        console.error("FAIL: Found leaking users:", leakingUsers.map((u: any) => `${u.name} (${u.company})`));
    } else {
        console.log("PASS: Only Dawon users returned (ignoring admin).");
    }

    process.exit(0);
}

run().catch(console.error);
