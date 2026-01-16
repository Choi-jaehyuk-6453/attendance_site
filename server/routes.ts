import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertSiteSchema, insertAttendanceLogSchema } from "@shared/schema";
import { z } from "zod";
import { startOfMonth, endOfMonth, format } from "date-fns";
import bcrypt from "bcryptjs";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "로그인이 필요합니다" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "로그인이 필요합니다" });
  }
  if (req.session.role !== "admin") {
    return res.status(403).json({ error: "관리자 권한이 필요합니다" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요" });
      }
      
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
      }
      
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
      }
      
      if (!user.isActive) {
        return res.status(403).json({ error: "비활성화된 계정입니다" });
      }
      
      req.session.userId = user.id;
      req.session.role = user.role;
      
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "로그인 처리 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "로그아웃 처리 중 오류가 발생했습니다" });
      }
      res.json({ message: "로그아웃 되었습니다" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ error: "사용자 정보를 불러오는데 실패했습니다" });
    }
  });

  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "사용자 목록을 불러오는데 실패했습니다" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      const existing = await storage.getUserByUsername(validatedData.username);
      if (existing) {
        return res.status(400).json({ error: "이미 존재하는 아이디입니다" });
      }
      
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Create user error:", error);
      res.status(500).json({ error: "사용자 생성 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/sites", requireAuth, async (req, res) => {
    try {
      const sites = await storage.getSites();
      res.json(sites);
    } catch (error) {
      console.error("Get sites error:", error);
      res.status(500).json({ error: "현장 목록을 불러오는데 실패했습니다" });
    }
  });

  app.post("/api/sites", requireAdmin, async (req, res) => {
    try {
      console.log("Creating site with data:", req.body);
      const validatedData = insertSiteSchema.parse(req.body);
      console.log("Validated data:", validatedData);
      const site = await storage.createSite(validatedData);
      console.log("Site created successfully:", site);
      res.status(201).json(site);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Create site error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: "현장 생성 중 오류가 발생했습니다", details: errorMessage });
    }
  });

  app.delete("/api/sites/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSite(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete site error:", error);
      res.status(500).json({ error: "현장 삭제 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/attendance", requireAdmin, async (req, res) => {
    try {
      const { month } = req.query;
      
      let startDate: string;
      let endDate: string;
      
      if (month && typeof month === "string") {
        const [year, monthNum] = month.split("-").map(Number);
        const start = new Date(year, monthNum - 1, 1);
        const end = endOfMonth(start);
        startDate = format(start, "yyyy-MM-dd");
        endDate = format(end, "yyyy-MM-dd");
      } else {
        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        startDate = format(start, "yyyy-MM-dd");
        endDate = format(end, "yyyy-MM-dd");
      }
      
      const logs = await storage.getAttendanceLogs(startDate, endDate);
      res.json(logs);
    } catch (error) {
      console.error("Get attendance error:", error);
      res.status(500).json({ error: "출근 기록을 불러오는데 실패했습니다" });
    }
  });

  app.get("/api/attendance/today/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (req.session.role !== "admin" && req.session.userId !== userId) {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }
      
      const today = format(new Date(), "yyyy-MM-dd");
      const log = await storage.getTodayAttendanceLog(userId, today);
      res.json(log || null);
    } catch (error) {
      console.error("Get today attendance error:", error);
      res.status(500).json({ error: "오늘 출근 기록을 불러오는데 실패했습니다" });
    }
  });

  app.get("/api/attendance/user/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { month } = req.query;
      
      if (req.session.role !== "admin" && req.session.userId !== userId) {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }
      
      let startDate: string;
      let endDate: string;
      
      if (month && typeof month === "string") {
        const [year, monthNum] = month.split("-").map(Number);
        const start = new Date(year, monthNum - 1, 1);
        const end = endOfMonth(start);
        startDate = format(start, "yyyy-MM-dd");
        endDate = format(end, "yyyy-MM-dd");
      } else {
        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        startDate = format(start, "yyyy-MM-dd");
        endDate = format(end, "yyyy-MM-dd");
      }
      
      const logs = await storage.getAttendanceLogsByUser(userId, startDate, endDate);
      res.json(logs);
    } catch (error) {
      console.error("Get user attendance error:", error);
      res.status(500).json({ error: "출근 기록을 불러오는데 실패했습니다" });
    }
  });

  app.post("/api/attendance/check-in", requireAuth, async (req, res) => {
    try {
      const { siteId, checkInDate, latitude, longitude } = req.body;
      const userId = req.session.userId!;
      
      if (!siteId || !checkInDate) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      const site = await storage.getSite(siteId);
      if (!site) {
        return res.status(404).json({ error: "현장을 찾을 수 없습니다" });
      }
      
      const existingLog = await storage.getTodayAttendanceLog(userId, checkInDate);
      if (existingLog) {
        return res.status(400).json({ error: "오늘 이미 출근 처리되었습니다" });
      }
      
      const log = await storage.createAttendanceLog({
        userId,
        siteId,
        checkInDate,
        latitude: latitude || null,
        longitude: longitude || null,
      });
      
      res.status(201).json({ ...log, siteName: site.name });
    } catch (error) {
      console.error("Check-in error:", error);
      res.status(500).json({ error: "출근 처리 중 오류가 발생했습니다" });
    }
  });

  app.post("/api/seed", async (req, res) => {
    try {
      const existingUsers = await storage.getUsers();
      if (existingUsers.length > 0) {
        return res.json({ message: "이미 초기 데이터가 있습니다", seeded: false });
      }

      const adminPassword = await bcrypt.hash("admin123", 10);
      const guardPassword = await bcrypt.hash("guard123", 10);

      const admin = await storage.createUser({
        username: "관리자",
        password: adminPassword,
        name: "관리자",
        role: "admin",
        company: "mirae_abm",
        phone: "010-1234-5678",
        isActive: true,
      });

      const guard1 = await storage.createUser({
        username: "guard1",
        password: guardPassword,
        name: "김경비",
        role: "guard",
        company: "mirae_abm",
        phone: "010-1111-2222",
        isActive: true,
      });

      const guard2 = await storage.createUser({
        username: "guard2",
        password: guardPassword,
        name: "이경비",
        role: "guard",
        company: "mirae_abm",
        phone: "010-3333-4444",
        isActive: true,
      });

      const guard3 = await storage.createUser({
        username: "guard3",
        password: guardPassword,
        name: "박경비",
        role: "guard",
        company: "dawon_pmc",
        phone: "010-5555-6666",
        isActive: true,
      });

      const site1 = await storage.createSite({
        name: "삼성타워",
        address: "서울시 강남구 테헤란로 123",
        company: "mirae_abm",
        isActive: true,
      });

      const site2 = await storage.createSite({
        name: "현대빌딩",
        address: "서울시 서초구 서초대로 456",
        company: "mirae_abm",
        isActive: true,
      });

      const site3 = await storage.createSite({
        name: "LG오피스",
        address: "서울시 영등포구 여의대로 789",
        company: "dawon_pmc",
        isActive: true,
      });

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      await storage.createAttendanceLog({
        userId: guard1.id,
        siteId: site1.id,
        checkInDate: format(yesterday, "yyyy-MM-dd"),
      });

      await storage.createAttendanceLog({
        userId: guard2.id,
        siteId: site1.id,
        checkInDate: format(yesterday, "yyyy-MM-dd"),
      });

      await storage.createAttendanceLog({
        userId: guard1.id,
        siteId: site1.id,
        checkInDate: format(twoDaysAgo, "yyyy-MM-dd"),
      });

      await storage.createAttendanceLog({
        userId: guard3.id,
        siteId: site3.id,
        checkInDate: format(yesterday, "yyyy-MM-dd"),
      });

      res.json({
        message: "초기 데이터가 생성되었습니다",
        seeded: true,
        data: {
          users: [
            { ...admin, password: undefined },
            { ...guard1, password: undefined },
            { ...guard2, password: undefined },
            { ...guard3, password: undefined },
          ],
          sites: [site1, site2, site3],
        },
      });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ error: "초기 데이터 생성 중 오류가 발생했습니다" });
    }
  });

  // Database status check endpoint
  app.all("/api/db-status", async (req, res) => {
    try {
      const { pool } = await import("./db");
      
      // Check if tables exist
      const tablesResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE';
      `);
      
      const tables = tablesResult.rows.map(r => r.table_name);
      
      // Check enum types
      const enumsResult = await pool.query(`
        SELECT typname FROM pg_type 
        WHERE typtype = 'e';
      `);
      
      const enums = enumsResult.rows.map(r => r.typname);
      
      // Count records in each table
      const counts: Record<string, number> = {};
      for (const table of tables) {
        try {
          const countResult = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
          counts[table] = parseInt(countResult.rows[0].count);
        } catch (e) {
          counts[table] = -1; // Error counting
        }
      }
      
      res.json({
        connected: true,
        tables,
        enums,
        counts,
        requiredTables: ['users', 'sites', 'attendance_logs', 'vacation_requests'],
        requiredEnums: ['role', 'company', 'vacation_status'],
        missingTables: ['users', 'sites', 'attendance_logs', 'vacation_requests'].filter(t => !tables.includes(t)),
        missingEnums: ['role', 'company', 'vacation_status'].filter(e => !enums.includes(e))
      });
    } catch (error) {
      console.error("DB status error:", error);
      res.status(500).json({ 
        connected: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Database setup endpoint for production
  app.all("/api/setup-db", async (req, res) => {
    try {
      const { pool } = await import("./db");
      
      // Create enums if they don't exist
      await pool.query(`
        DO $$ BEGIN
          CREATE TYPE role AS ENUM ('admin', 'guard');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      
      await pool.query(`
        DO $$ BEGIN
          CREATE TYPE company AS ENUM ('mirae_abm', 'dawon_pmc');
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
      
      // Create tables if they don't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          role role NOT NULL DEFAULT 'guard',
          company company NOT NULL DEFAULT 'mirae_abm',
          phone TEXT,
          site_id VARCHAR,
          is_active BOOLEAN NOT NULL DEFAULT true
        );
      `);
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sites (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          address TEXT,
          company company NOT NULL DEFAULT 'mirae_abm',
          qr_code TEXT,
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
          longitude TEXT
        );
      `);
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS vacation_requests (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR NOT NULL REFERENCES users(id),
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          reason TEXT,
          status vacation_status NOT NULL DEFAULT 'pending',
          requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
          responded_at TIMESTAMP,
          responded_by VARCHAR REFERENCES users(id)
        );
      `);
      
      res.json({ 
        message: "데이터베이스 테이블이 성공적으로 생성되었습니다.",
        success: true 
      });
    } catch (error) {
      console.error("Setup DB error:", error);
      res.status(500).json({ 
        error: "데이터베이스 설정 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.all("/api/init-admin", async (req, res) => {
    try {
      const existingUsers = await storage.getUsers();
      const existingAdmin = existingUsers.find(u => u.role === "admin");
      
      if (existingAdmin) {
        const newPassword = await bcrypt.hash("admin123", 10);
        await storage.updateUser(existingAdmin.id, { 
          username: "관리자",
          password: newPassword 
        });
        return res.json({ 
          message: "관리자 계정이 초기화되었습니다. 아이디: 관리자, 비밀번호: admin123",
          reset: true 
        });
      }
      
      const adminPassword = await bcrypt.hash("admin123", 10);
      await storage.createUser({
        username: "관리자",
        password: adminPassword,
        name: "관리자",
        role: "admin",
        company: "mirae_abm",
        phone: "010-1234-5678",
        isActive: true,
      });
      
      res.json({ 
        message: "관리자 계정이 생성되었습니다. 아이디: 관리자, 비밀번호: admin123",
        created: true 
      });
    } catch (error) {
      console.error("Init admin error:", error);
      res.status(500).json({ error: "관리자 계정 초기화 중 오류가 발생했습니다" });
    }
  });

  return httpServer;
}
