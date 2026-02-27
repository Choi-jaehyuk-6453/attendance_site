import "dotenv/config";
import pg from "pg";
import * as schema from "../shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function verifyDrizzle() {
    try {
        const users = await db.select().from(schema.users).where(eq(schema.users.name, '김철수'));
        const user = users[0];
        console.log(`Worker siteId: '${user?.siteId}'`);

        let sites = await db.select().from(schema.sites).where(eq(schema.sites.isActive, true));

        const matchingSite = sites.find(s => s.id === user?.siteId);
        console.log("Found site via find:", matchingSite?.name);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
verifyDrizzle();
