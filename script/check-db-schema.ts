
import fs from 'fs';
import path from 'path';
import { sql } from "drizzle-orm";

async function checkSchema() {
    // Load .env manually
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim();
            }
        });
    }

    // Dynamic import to ensure env is loaded first
    const { db } = await import("../server/db");

    try {
        const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sites';
    `);
        console.log("Columns in sites table:", result.rows.map((row: any) => `${row.column_name} (${row.data_type})`));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
