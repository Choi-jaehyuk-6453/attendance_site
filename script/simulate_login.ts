import { storage } from "../server/storage";
import bcrypt from "bcryptjs";

async function loginSim(usernameRaw: string, passwordRaw: string) {
    console.log(`Simulating login for username: '${usernameRaw}', password: '${passwordRaw}'`);
    
    const username = String(usernameRaw || "").trim();
    const password = String(passwordRaw || "").trim();

    const matchingUsers = await storage.getUsersByUsername(username);
    console.log(`Found ${matchingUsers.length} matching users`);

    if (matchingUsers.length === 0) {
        console.log("FAIL: 401 아이디 또는 비밀번호가 올바르지 않습니다");
        return;
    }

    let matchedUser = null;
    for (const user of matchingUsers) {
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (isValidPassword) {
            matchedUser = user;
            break;
        }
    }

    if (!matchedUser) {
        console.log("FAIL: 401 아이디 또는 비밀번호가 올바르지 않습니다");
        return;
    }

    if (matchedUser.role === "worker" && matchedUser.siteId) {
        const site = await storage.getSite(matchedUser.siteId);
        if (!site || !site.isActive) {
            console.log("FAIL: 401 배정된 현장이 삭제되었습니다.");
            return;
        }
    }

    let effectiveRole = matchedUser.role;
    if (matchedUser.role === "site_manager" && matchedUser.username !== username) {
        effectiveRole = "worker";
    }

    console.log(`SUCCESS! Logged in as ${matchedUser.name} with effectiveRole ${effectiveRole}`);
}

async function run() {
    await loginSim("고재룡", "4199");
    await loginSim("유만", "1885");
    process.exit(0);
}

run().catch(console.error);
