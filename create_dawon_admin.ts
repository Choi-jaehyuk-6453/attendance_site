
// create_dawon_admin.ts
import { db } from "./server/db";
import { users } from "./shared/schema";
import { hash } from "bcryptjs";

async function main() {
    const password = await hash("1234", 10);

    await db.insert(users).values({
        username: "dawon",
        password: password,
        name: "다원관리자",
        role: "hq_admin",
        company: "dawon_pmc",
        isActive: true,
    });

    console.log("Created 'dawon' admin user (password: 1234) for Dawon PMC.");
    process.exit(0);
}

main().catch(console.error);
