import { execSync } from "child_process";

const supabaseUrl = "postgresql://postgres.ojoeyajhvpuedydnlheo:dkflfkd12!%40@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres";

try {
    console.log("Removing POSTGRES_URL from production...");
    try {
        execSync("npx vercel env rm POSTGRES_URL production -y");
    } catch (e) {
        console.log("POSTGRES_URL may not exist or already removed.");
    }

    console.log("Removing DATABASE_URL from production (again)...");
    try {
        execSync("npx vercel env rm DATABASE_URL production -y");
    } catch (e) {
        console.log("DATABASE_URL already removed.");
    }

    console.log("Adding Supabase DATABASE_URL to production...");
    // Use Vercel CLI with echo to add the variable
    execSync(`echo "${supabaseUrl}" | npx vercel env add DATABASE_URL production`);
    console.log("Successfully added DATABASE_URL to Vercel.");
} catch (error) {
    console.error("Error setting environment variables:", error?.stdout?.toString() || error);
}
