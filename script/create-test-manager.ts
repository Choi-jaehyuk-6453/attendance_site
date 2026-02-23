
import { storage } from "../server/storage";
import { insertSiteSchema, insertUserSchema } from "../shared/schema";
import bcrypt from "bcryptjs";

async function main() {
    // Create site
    const site = await storage.createSite({
        name: "TestSiteLogin",
        address: "Test Address",
        contractStartDate: "2024-01-01",
        contractEndDate: "2024-12-31",
        qrCode: "test-qr",
        isActive: true,
        company: "mirae_abm"
    });
    console.log("Created site:", site.id, site.name);

    // Create Site Manager
    // Name: ManagerKim, Phone: 010-1234-1234
    // Username: TestSiteLogin (Site Name)
    const hashedPassword = await bcrypt.hash("1234", 10);
    const user = await storage.createUser({
        username: "TestSiteLogin",
        password: hashedPassword,
        name: "ManagerKim",
        role: "site_manager",
        phone: "010-1234-1234",
        siteId: site.id,
        isActive: true,
        company: "mirae_abm"
    });
    console.log("Created user:", user.id, user.name, user.username, user.role);
    process.exit(0);
}

main().catch(console.error);
