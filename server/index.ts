import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
// Trigger restart
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";

async function initializeDatabase() {
  try {
    // Drop old enums and types to start fresh
    // Create enums if they don't exist
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE role AS ENUM ('hq_admin', 'site_manager', 'worker');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE attendance_type AS ENUM ('normal', 'annual', 'half_day', 'sick', 'family_event', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE attendance_source AS ENUM ('qr', 'manual', 'vacation');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE vacation_status AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE vacation_type AS ENUM ('annual', 'half_day', 'sick', 'family_event', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        address TEXT,
        contract_start_date DATE,
        contract_end_date DATE,
        qr_code TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id VARCHAR NOT NULL REFERENCES sites(id),
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role role NOT NULL DEFAULT 'worker',
        phone TEXT,
        site_id VARCHAR,
        department_id VARCHAR,
        hire_date DATE,
        is_active BOOLEAN NOT NULL DEFAULT true
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        site_id VARCHAR NOT NULL REFERENCES sites(id),
        check_in_time TIMESTAMP NOT NULL DEFAULT NOW(),
        check_in_date DATE NOT NULL,
        latitude TEXT,
        longitude TEXT,
        attendance_type attendance_type NOT NULL DEFAULT 'normal',
        source attendance_source NOT NULL DEFAULT 'qr',
        vacation_request_id VARCHAR
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vacation_requests (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        vacation_type vacation_type NOT NULL DEFAULT 'annual',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days INTEGER NOT NULL DEFAULT 1,
        reason TEXT,
        substitute_work TEXT NOT NULL DEFAULT 'X',
        status vacation_status NOT NULL DEFAULT 'pending',
        requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
        responded_at TIMESTAMP,
        responded_by VARCHAR REFERENCES users(id),
        rejection_reason TEXT
      );
    `);

    // Create session table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
      WITH (OIDS=FALSE);
    `);

    // Add constraint if not exists (ignore error if exists)
    try {
      await pool.query(`
        ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      `);
    } catch (e: any) {
      if (e.code !== '42P16') { // 42P16: multiple primary keys
        console.log('Session table constraint notice:', e.message);
      }
    }

    await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: "hq_admin" | "site_manager" | "worker";
    siteId?: string;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Trust proxy for production
app.set("trust proxy", 1);

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "attendance-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize database tables on startup
  await initializeDatabase();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})().catch((err) => {
  console.error("SERVER STARTUP FAILED:", err);
  process.exit(1);
});
