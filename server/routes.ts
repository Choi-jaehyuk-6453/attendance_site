import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertSiteSchema, insertAttendanceLogSchema, insertContactSchema, insertVacationRequestSchema, type VacationRequest } from "@shared/schema";
import { sendEmail } from "./email";
import { generateAttendancePdf } from "./pdf-generator";
import { generateVacationPdf, generateVacationStatusPdf } from "./vacation-pdf-generator";
import { z } from "zod";
import { startOfMonth, endOfMonth, format, differenceInDays, eachDayOfInterval, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import bcrypt from "bcryptjs";
import { calculateAnnualLeave } from "@shared/leave-utils";
import { getKSTNow, getKSTToday, getKSTYear } from "@shared/kst-utils";

// Helper function to create attendance records for vacation days
async function createVacationAttendanceRecords(vacation: VacationRequest): Promise<void> {
  const user = await storage.getUser(vacation.userId);
  if (!user || !user.siteId) return;
  
  // Map vacation type to attendance type
  const attendanceTypeMap: Record<string, "annual" | "half_day" | "sick" | "family_event" | "other"> = {
    annual: "annual",
    half_day: "half_day", 
    sick: "sick",
    family_event: "family_event",
    other: "other",
  };
  
  const attendanceType = attendanceTypeMap[vacation.vacationType] || "annual";
  const startDate = parseISO(vacation.startDate);
  const endDate = parseISO(vacation.endDate);
  const dates = eachDayOfInterval({ start: startDate, end: endDate });
  
  for (const date of dates) {
    const dateStr = format(date, "yyyy-MM-dd");
    
    // Check if attendance log already exists for this date
    const existing = await storage.getAttendanceLogByUserAndDate(vacation.userId, dateStr);
    if (existing) {
      await storage.updateAttendanceLog(existing.id, {
        attendanceType,
        source: "vacation",
        vacationRequestId: vacation.id,
      });
    } else {
      await storage.createAttendanceLog({
        userId: vacation.userId,
        siteId: user.siteId,
        checkInDate: dateStr,
        attendanceType,
        source: "vacation",
        vacationRequestId: vacation.id,
      });
    }
  }
}

// Helper function to delete attendance records for vacation
async function deleteVacationAttendanceRecords(vacationId: string): Promise<void> {
  await storage.deleteAttendanceLogsByVacationId(vacationId);
}

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
      
      // Get all active users with this username (allows duplicate names)
      const matchingUsers = await storage.getUsersByUsername(username);
      
      if (matchingUsers.length === 0) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
      }
      
      // Find the user with matching password
      let matchedUser = null;
      for (const user of matchingUsers) {
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (isValidPassword) {
          matchedUser = user;
          break;
        }
      }
      
      if (!matchedUser) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
      }
      
      // Check if user's assigned site is still active (for guards)
      if (matchedUser.role === "guard" && matchedUser.siteId) {
        const site = await storage.getSite(matchedUser.siteId);
        if (!site || !site.isActive) {
          return res.status(401).json({ error: "배정된 현장이 삭제되었습니다. 관리자에게 문의해주세요." });
        }
      }
      
      req.session.userId = matchedUser.id;
      req.session.role = matchedUser.role;
      
      const { password: _, ...userWithoutPassword } = matchedUser;
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
      
      // Check for same name + same phone at same site (true duplicate)
      const existingUsers = await storage.getUsersByUsername(validatedData.username);
      const last4Digits = validatedData.password; // password is last 4 digits of phone before hashing
      for (const existing of existingUsers) {
        const samePassword = await bcrypt.compare(last4Digits, existing.password);
        if (samePassword && existing.siteId === validatedData.siteId) {
          return res.status(400).json({ error: "같은 현장에 동일한 이름과 전화번호를 가진 근무자가 이미 등록되어 있습니다" });
        }
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
      
      // Check for unique constraint violation (duplicate username)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("unique") || errorMessage.includes("duplicate") || errorMessage.includes("23505")) {
        return res.status(400).json({ error: "이미 동일한 이름의 근무자가 등록되어 있습니다. 다른 이름을 사용해주세요." });
      }
      
      res.status(500).json({ error: "사용자 생성 중 오류가 발생했습니다" });
    }
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone, hireDate, siteId, isActive, shift } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) {
        updateData.name = name;
        updateData.username = name; // username = name for guards
      }
      if (phone !== undefined) {
        updateData.phone = phone;
        // Update password to last 4 digits of phone
        const last4Digits = phone.replace(/\D/g, "").slice(-4);
        if (last4Digits.length === 4) {
          updateData.password = await bcrypt.hash(last4Digits, 10);
        }
      }
      if (hireDate !== undefined) updateData.hireDate = hireDate;
      if (siteId !== undefined) updateData.siteId = siteId;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (shift !== undefined) updateData.shift = shift;
      
      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "사용자 수정 중 오류가 발생했습니다" });
    }
  });

  // Toggle active status
  app.patch("/api/users/:id/toggle-active", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      const updated = await storage.updateUser(id, { isActive: !user.isActive });
      const { password: _, ...userWithoutPassword } = updated!;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Toggle user active error:", error);
      res.status(500).json({ error: "상태 변경 중 오류가 발생했습니다" });
    }
  });

  // Hard delete - removes all data including attendance logs
  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      await storage.deleteUser(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "사용자 삭제 중 오류가 발생했습니다" });
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

  app.patch("/api/sites/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, address, company, contractStartDate, contractEndDate } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (address !== undefined) updateData.address = address;
      if (company !== undefined) updateData.company = company;
      if (contractStartDate !== undefined) updateData.contractStartDate = contractStartDate;
      if (contractEndDate !== undefined) updateData.contractEndDate = contractEndDate;
      
      const site = await storage.updateSite(id, updateData);
      if (!site) {
        return res.status(404).json({ error: "현장을 찾을 수 없습니다" });
      }
      res.json(site);
    } catch (error) {
      console.error("Update site error:", error);
      res.status(500).json({ error: "현장 수정 중 오류가 발생했습니다" });
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
        const now = getKSTNow();
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
      
      const today = getKSTToday();
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
        const now = getKSTNow();
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
      
      // Server-side validation: Check if guard's assigned site matches QR site
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      if (!user.siteId) {
        return res.status(400).json({ error: "배정된 현장이 없습니다. 관리자에게 문의하세요." });
      }
      
      if (user.siteId !== siteId) {
        return res.status(400).json({ error: `본인 현장(${site.name})이 아닌 다른 현장의 QR 코드입니다.` });
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
        source: "qr",
      });
      
      res.status(201).json({ ...log, siteName: site.name });
    } catch (error) {
      console.error("Check-in error:", error);
      res.status(500).json({ error: "출근 처리 중 오류가 발생했습니다" });
    }
  });

  const validAttendanceTypes = ["normal", "annual", "half_day", "sick", "family_event", "other"] as const;

  app.post("/api/admin/attendance", requireAdmin, async (req, res) => {
    try {
      const { userId, siteId, checkInDate, attendanceType } = req.body;
      
      if (!userId || !siteId || !checkInDate) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }

      const resolvedType = attendanceType || "normal";
      if (!validAttendanceTypes.includes(resolvedType)) {
        return res.status(400).json({ error: "유효하지 않은 출근/휴가 유형입니다" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      const site = await storage.getSite(siteId);
      if (!site) {
        return res.status(404).json({ error: "현장을 찾을 수 없습니다" });
      }
      
      const existingLog = await storage.getAttendanceLogByUserAndDate(userId, checkInDate);
      if (existingLog) {
        return res.status(400).json({ error: "해당 날짜에 이미 출근 기록이 있습니다" });
      }
      
      const log = await storage.createAttendanceLog({
        userId,
        siteId,
        checkInDate,
        latitude: null,
        longitude: null,
        attendanceType: resolvedType,
        source: "manual",
      });
      
      res.status(201).json(log);
    } catch (error) {
      console.error("Admin create attendance error:", error);
      res.status(500).json({ error: "출근 기록 생성 중 오류가 발생했습니다" });
    }
  });

  app.patch("/api/admin/attendance", requireAdmin, async (req, res) => {
    try {
      const { userId, checkInDate, attendanceType } = req.body;
      
      if (!userId || !checkInDate || !attendanceType) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }

      if (!validAttendanceTypes.includes(attendanceType)) {
        return res.status(400).json({ error: "유효하지 않은 출근/휴가 유형입니다" });
      }
      
      const existingLog = await storage.getAttendanceLogByUserAndDate(userId, checkInDate);
      if (!existingLog) {
        return res.status(404).json({ error: "해당 날짜의 출근 기록을 찾을 수 없습니다" });
      }
      
      const updateData: any = { attendanceType };
      if (existingLog.source !== "vacation") {
        updateData.source = "manual";
      }
      const updated = await storage.updateAttendanceLog(existingLog.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Admin update attendance error:", error);
      res.status(500).json({ error: "출근 기록 수정 중 오류가 발생했습니다" });
    }
  });

  app.delete("/api/admin/attendance", requireAdmin, async (req, res) => {
    try {
      const { userId, checkInDate } = req.body;
      
      if (!userId || !checkInDate) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }
      
      const existingLog = await storage.getAttendanceLogByUserAndDate(userId, checkInDate);
      if (!existingLog) {
        return res.status(404).json({ error: "해당 날짜의 출근 기록을 찾을 수 없습니다" });
      }
      
      await storage.deleteAttendanceLogByUserAndDate(userId, checkInDate);
      
      res.status(204).send();
    } catch (error) {
      console.error("Admin delete attendance error:", error);
      res.status(500).json({ error: "출근 기록 삭제 중 오류가 발생했습니다" });
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

      const today = getKSTNow();
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
      
      await pool.query(`
        DO $$ BEGIN
          CREATE TYPE attendance_type AS ENUM ('normal', 'annual', 'half_day', 'sick', 'family_event', 'other');
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
          longitude TEXT,
          attendance_type attendance_type NOT NULL DEFAULT 'normal',
          vacation_request_id VARCHAR
        );
      `);
      
      // Add new columns if they don't exist (for existing databases)
      await pool.query(`
        ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS attendance_type attendance_type NOT NULL DEFAULT 'normal';
      `).catch(() => {});
      await pool.query(`
        ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS vacation_request_id VARCHAR;
      `).catch(() => {});
      
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

  // Contacts API
  app.get("/api/contacts", requireAdmin, async (req, res) => {
    try {
      const contacts = await storage.getContacts();
      res.json(contacts);
    } catch (error) {
      console.error("Get contacts error:", error);
      res.status(500).json({ error: "담당자 목록을 불러오는데 실패했습니다" });
    }
  });

  app.post("/api/contacts", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(validatedData);
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Create contact error:", error);
      res.status(500).json({ error: "담당자 생성 중 오류가 발생했습니다" });
    }
  });

  app.patch("/api/contacts/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { department, name, email, company } = req.body;
      
      const updateData: any = {};
      if (department !== undefined) updateData.department = department;
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (company !== undefined) updateData.company = company;
      
      const contact = await storage.updateContact(id, updateData);
      if (!contact) {
        return res.status(404).json({ error: "담당자를 찾을 수 없습니다" });
      }
      res.json(contact);
    } catch (error) {
      console.error("Update contact error:", error);
      res.status(500).json({ error: "담당자 수정 중 오류가 발생했습니다" });
    }
  });

  app.delete("/api/contacts/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteContact(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete contact error:", error);
      res.status(500).json({ error: "담당자 삭제 중 오류가 발생했습니다" });
    }
  });

  // Send email with PDF attachment (generates PDF on server)
  app.post("/api/send-attendance-email", requireAdmin, async (req, res) => {
    try {
      const { contactIds, selectedSiteId, selectedMonth } = req.body;
      
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "수신자를 선택해주세요" });
      }
      
      if (!selectedSiteId) {
        return res.status(400).json({ error: "현장을 선택해주세요" });
      }
      
      if (!selectedMonth) {
        return res.status(400).json({ error: "월을 선택해주세요" });
      }
      
      const contacts = await storage.getContacts();
      const selectedContacts = contacts.filter(c => contactIds.includes(c.id));
      
      if (selectedContacts.length === 0) {
        return res.status(400).json({ error: "유효한 수신자가 없습니다" });
      }
      
      const emailAddresses = selectedContacts.map(c => c.email);
      const recipientNames = selectedContacts.map(c => `${c.name} (${c.department})`).join(", ");
      
      // Fetch data for PDF generation
      const users = await storage.getUsers();
      const sites = await storage.getSites();
      const attendanceLogs = await storage.getAttendanceLogs();
      
      const selectedSite = sites.find(s => s.id === selectedSiteId);
      const siteName = selectedSite?.name || "전체";
      const monthDate = new Date(selectedMonth);
      const monthString = format(monthDate, "yyyy년 M월", { locale: ko });
      
      // Generate PDF on server
      const pdfBuffer = await generateAttendancePdf({
        users,
        attendanceLogs,
        sites,
        selectedMonth: monthDate,
        selectedSiteId,
      });
      
      const fileName = `출근기록부_${siteName}_${format(monthDate, "yyyy년_M월", { locale: ko })}.pdf`;
      
      const success = await sendEmail({
        to: emailAddresses,
        subject: `[출근기록부] ${siteName} - ${monthString}`,
        html: `
          <div style="font-family: 'Noto Sans KR', sans-serif; padding: 20px;">
            <h2>출근기록부 발송</h2>
            <p><strong>현장:</strong> ${siteName}</p>
            <p><strong>기간:</strong> ${monthString}</p>
            <p><strong>수신:</strong> ${recipientNames}</p>
            <br/>
            <p>첨부된 PDF 파일을 확인해 주세요.</p>
            <br/>
            <p style="color: #666; font-size: 12px;">본 메일은 경비원 근태관리 시스템에서 자동 발송되었습니다.</p>
          </div>
        `,
        attachments: [
          {
            filename: fileName,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
      
      if (success) {
        res.json({ 
          message: `${selectedContacts.length}명에게 이메일을 발송했습니다`,
          recipients: recipientNames
        });
      } else {
        res.status(500).json({ error: "이메일 발송에 실패했습니다" });
      }
    } catch (error) {
      console.error("Send email error:", error);
      res.status(500).json({ error: "이메일 발송 중 오류가 발생했습니다" });
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

  // ========== Vacation Management API ==========
  
  // Get all vacation requests (admin)
  app.get("/api/vacations", requireAdmin, async (req, res) => {
    try {
      const { status, userId, siteId } = req.query;
      let vacations = await storage.getVacationRequests();
      
      if (status && typeof status === "string") {
        vacations = vacations.filter(v => v.status === status);
      }
      
      if (userId && typeof userId === "string") {
        vacations = vacations.filter(v => v.userId === userId);
      }
      
      if (siteId && typeof siteId === "string") {
        const users = await storage.getUsers();
        const siteUserIds = users.filter(u => u.siteId === siteId).map(u => u.id);
        vacations = vacations.filter(v => siteUserIds.includes(v.userId));
      }
      
      res.json(vacations);
    } catch (error) {
      console.error("Get vacations error:", error);
      res.status(500).json({ error: "휴가 신청 목록을 불러오는데 실패했습니다" });
    }
  });

  // Get user's own vacation requests (guard)
  app.get("/api/vacations/my", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const vacations = await storage.getVacationRequestsByUser(userId);
      res.json(vacations);
    } catch (error) {
      console.error("Get my vacations error:", error);
      res.status(500).json({ error: "휴가 신청 목록을 불러오는데 실패했습니다" });
    }
  });

  // Get user's leave balance
  app.get("/api/vacations/balance", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      if (!user.hireDate) {
        return res.json({
          totalAccrued: 0,
          totalUsed: 0,
          totalRemaining: 0,
          accruals: [],
          yearsOfService: 0,
          monthsOfService: 0,
          message: "입사일이 설정되지 않았습니다",
        });
      }
      
      const vacations = await storage.getVacationRequestsByUser(userId);
      const approvedVacations = vacations.filter(v => v.status === "approved");
      const usedDays = approvedVacations
        .filter(v => v.vacationType !== "family_event" && v.vacationType !== "other")
        .reduce((sum, v) => sum + (v.days || 1), 0);
      
      const balance = calculateAnnualLeave(new Date(user.hireDate), usedDays, getKSTNow());
      res.json(balance);
    } catch (error) {
      console.error("Get leave balance error:", error);
      res.status(500).json({ error: "연차 잔여일수를 계산하는데 실패했습니다" });
    }
  });

  // Get specific user's leave balance (admin)
  app.get("/api/vacations/balance/:userId", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      if (!user.hireDate) {
        return res.json({
          totalAccrued: 0,
          totalUsed: 0,
          totalRemaining: 0,
          accruals: [],
          yearsOfService: 0,
          monthsOfService: 0,
          message: "입사일이 설정되지 않았습니다",
        });
      }
      
      const vacations = await storage.getVacationRequestsByUser(userId);
      const approvedVacations = vacations.filter(v => v.status === "approved");
      const usedDays = approvedVacations
        .filter(v => v.vacationType !== "family_event" && v.vacationType !== "other")
        .reduce((sum, v) => sum + (v.days || 1), 0);
      
      const balance = calculateAnnualLeave(new Date(user.hireDate), usedDays, getKSTNow());
      res.json(balance);
    } catch (error) {
      console.error("Get user leave balance error:", error);
      res.status(500).json({ error: "연차 잔여일수를 계산하는데 실패했습니다" });
    }
  });

  // Create vacation request (guard or admin)
  app.post("/api/vacations", requireAuth, async (req, res) => {
    try {
      const { vacationType, startDate, endDate, reason, substituteWork, userId: requestUserId } = req.body;
      
      // Admin can create vacation for any user, guard can only create for themselves
      let targetUserId = req.session.userId!;
      const isAdminCreating = requestUserId && req.session.role === "admin";
      if (isAdminCreating) {
        targetUserId = requestUserId;
      }
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "시작일과 종료일을 입력해주세요" });
      }
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = vacationType === "half_day" ? 0.5 : differenceInDays(end, start) + 1;
      
      // Create the vacation request
      let vacation = await storage.createVacationRequest({
        userId: targetUserId,
        vacationType: vacationType || "annual",
        startDate,
        endDate,
        days,
        reason: reason || null,
        substituteWork: substituteWork || "X",
      });
      
      // Admin-created vacations are auto-approved
      if (isAdminCreating) {
        vacation = (await storage.updateVacationRequest(vacation.id, {
          status: "approved",
          respondedAt: new Date(),
          respondedBy: req.session.userId,
        }))!;
        
        // Create attendance records for the approved vacation
        await createVacationAttendanceRecords(vacation);
      }
      
      res.status(201).json(vacation);
    } catch (error) {
      console.error("Create vacation request error:", error);
      res.status(500).json({ error: "휴가 신청 중 오류가 발생했습니다" });
    }
  });

  // Approve vacation request (admin)
  app.patch("/api/vacations/:id/approve", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.session.userId!;
      
      const vacation = await storage.updateVacationRequest(id, {
        status: "approved",
        respondedAt: new Date(),
        respondedBy: adminId,
      });
      
      if (!vacation) {
        return res.status(404).json({ error: "휴가 신청을 찾을 수 없습니다" });
      }
      
      // Create attendance records for the approved vacation
      await createVacationAttendanceRecords(vacation);
      
      res.json(vacation);
    } catch (error) {
      console.error("Approve vacation error:", error);
      res.status(500).json({ error: "휴가 승인 중 오류가 발생했습니다" });
    }
  });

  // Reject vacation request (admin)
  app.patch("/api/vacations/:id/reject", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;
      const adminId = req.session.userId!;
      
      const vacation = await storage.updateVacationRequest(id, {
        status: "rejected",
        respondedAt: new Date(),
        respondedBy: adminId,
        rejectionReason: rejectionReason || null,
      });
      
      if (!vacation) {
        return res.status(404).json({ error: "휴가 신청을 찾을 수 없습니다" });
      }
      
      res.json(vacation);
    } catch (error) {
      console.error("Reject vacation error:", error);
      res.status(500).json({ error: "휴가 반려 중 오류가 발생했습니다" });
    }
  });

  // Update vacation request (admin)
  app.patch("/api/vacations/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { vacationType, startDate, endDate, days, reason, status } = req.body;
      
      const updateData: any = {};
      if (vacationType !== undefined) updateData.vacationType = vacationType;
      if (startDate !== undefined) updateData.startDate = startDate;
      if (endDate !== undefined) updateData.endDate = endDate;
      if (reason !== undefined) updateData.reason = reason;
      if (status !== undefined) updateData.status = status;
      
      // Recalculate days if dates are provided but days is not explicitly set
      if ((startDate !== undefined || endDate !== undefined) && days === undefined) {
        const existingVacation = await storage.getVacationRequests();
        const current = existingVacation.find(v => v.id === id);
        if (current) {
          const newStart = new Date(startDate || current.startDate);
          const newEnd = new Date(endDate || current.endDate);
          const newVacationType = vacationType || current.vacationType;
          updateData.days = newVacationType === "half_day" ? 0.5 : differenceInDays(newEnd, newStart) + 1;
        }
      } else if (days !== undefined) {
        updateData.days = days;
      }
      
      const vacation = await storage.updateVacationRequest(id, updateData);
      
      if (!vacation) {
        return res.status(404).json({ error: "휴가 신청을 찾을 수 없습니다" });
      }
      
      res.json(vacation);
    } catch (error) {
      console.error("Update vacation error:", error);
      res.status(500).json({ error: "휴가 수정 중 오류가 발생했습니다" });
    }
  });

  // Delete vacation request (admin)
  app.delete("/api/vacations/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Delete associated attendance records first
      await deleteVacationAttendanceRecords(id);
      
      await storage.deleteVacationRequest(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete vacation error:", error);
      res.status(500).json({ error: "휴가 삭제 중 오류가 발생했습니다" });
    }
  });

  // Download vacation PDF (admin)
  app.get("/api/vacation-pdf/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const vacations = await storage.getVacationRequests();
      const vacation = vacations.find(v => v.id === id);
      
      if (!vacation) {
        return res.status(404).json({ error: "휴가 신청을 찾을 수 없습니다" });
      }
      
      const users = await storage.getUsers();
      const user = users.find(u => u.id === vacation.userId);
      
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }
      
      const sites = await storage.getSites();
      const site = user.siteId ? sites.find(s => s.id === user.siteId) : null;
      
      const pdfBuffer = await generateVacationPdf({
        vacation,
        user,
        site,
      });
      
      const fileName = `휴가신청서_${user?.name}_${format(new Date(vacation.startDate), "yyyy-MM-dd")}.pdf`;
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Download vacation PDF error:", error);
      res.status(500).json({ error: "PDF 생성 중 오류가 발생했습니다" });
    }
  });

  // Download vacation status PDF (admin)
  app.get("/api/vacation-status-pdf", requireAdmin, async (req, res) => {
    try {
      const { siteId, year } = req.query;
      
      const users = await storage.getUsers();
      const sites = await storage.getSites();
      const vacations = await storage.getVacationRequests();
      
      const selectedSite = siteId && siteId !== "all" ? sites.find(s => s.id === siteId) : null;
      const siteName = selectedSite?.name || "전체";
      const targetYear = year ? parseInt(year as string) : getKSTYear();
      
      const pdfBuffer = await generateVacationStatusPdf({
        users,
        sites,
        vacations,
        siteId: siteId && siteId !== "all" ? siteId as string : undefined,
        year: targetYear,
      });
      
      const fileName = `휴가현황_${siteName}_${targetYear}년.pdf`;
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Download vacation status PDF error:", error);
      res.status(500).json({ error: "PDF 생성 중 오류가 발생했습니다" });
    }
  });

  // Send vacation PDF email (admin)
  app.post("/api/send-vacation-email", requireAdmin, async (req, res) => {
    try {
      const { contactIds, vacationId } = req.body;
      
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "수신자를 선택해주세요" });
      }
      
      if (!vacationId) {
        return res.status(400).json({ error: "휴가 신청을 선택해주세요" });
      }
      
      const contacts = await storage.getContacts();
      const selectedContacts = contacts.filter(c => contactIds.includes(c.id));
      
      if (selectedContacts.length === 0) {
        return res.status(400).json({ error: "유효한 수신자가 없습니다" });
      }
      
      const emailAddresses = selectedContacts.map(c => c.email);
      const recipientNames = selectedContacts.map(c => `${c.name} (${c.department})`).join(", ");
      
      const vacations = await storage.getVacationRequests();
      const vacation = vacations.find(v => v.id === vacationId);
      
      if (!vacation) {
        return res.status(404).json({ error: "휴가 신청을 찾을 수 없습니다" });
      }
      
      const users = await storage.getUsers();
      const user = users.find(u => u.id === vacation.userId);
      const sites = await storage.getSites();
      const site = user?.siteId ? sites.find(s => s.id === user.siteId) : null;
      
      const pdfBuffer = await generateVacationPdf({
        vacation,
        user: user!,
        site,
      });
      
      const fileName = `휴가신청서_${user?.name}_${format(new Date(vacation.startDate), "yyyy-MM-dd")}.pdf`;
      
      const success = await sendEmail({
        to: emailAddresses,
        subject: `[휴가신청서] ${user?.name} - ${format(new Date(vacation.startDate), "yyyy년 M월 d일", { locale: ko })}`,
        html: `
          <div style="font-family: 'Noto Sans KR', sans-serif; padding: 20px;">
            <h2>휴가신청서 발송</h2>
            <p><strong>신청자:</strong> ${user?.name}</p>
            <p><strong>현장:</strong> ${site?.name || "미배정"}</p>
            <p><strong>기간:</strong> ${format(new Date(vacation.startDate), "yyyy년 M월 d일", { locale: ko })} ~ ${format(new Date(vacation.endDate), "yyyy년 M월 d일", { locale: ko })}</p>
            <p><strong>일수:</strong> ${vacation.days}일</p>
            <p><strong>사유:</strong> ${vacation.reason || "-"}</p>
            <br/>
            <p>첨부된 PDF 파일을 확인해 주세요.</p>
            <br/>
            <p style="color: #666; font-size: 12px;">본 메일은 경비원 근태관리 시스템에서 자동 발송되었습니다.</p>
          </div>
        `,
        attachments: [
          {
            filename: fileName,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
      
      if (success) {
        res.json({ 
          message: `${selectedContacts.length}명에게 이메일을 발송했습니다`,
          recipients: recipientNames
        });
      } else {
        res.status(500).json({ error: "이메일 발송에 실패했습니다" });
      }
    } catch (error) {
      console.error("Send vacation email error:", error);
      res.status(500).json({ error: "이메일 발송 중 오류가 발생했습니다" });
    }
  });

  // Send vacation status PDF email (admin)
  app.post("/api/send-vacation-status-email", requireAdmin, async (req, res) => {
    try {
      const { contactIds, siteId, year } = req.body;
      
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "수신자를 선택해주세요" });
      }
      
      const contacts = await storage.getContacts();
      const selectedContacts = contacts.filter(c => contactIds.includes(c.id));
      
      if (selectedContacts.length === 0) {
        return res.status(400).json({ error: "유효한 수신자가 없습니다" });
      }
      
      const emailAddresses = selectedContacts.map(c => c.email);
      const recipientNames = selectedContacts.map(c => `${c.name} (${c.department})`).join(", ");
      
      const users = await storage.getUsers();
      const sites = await storage.getSites();
      const vacations = await storage.getVacationRequests();
      
      const selectedSite = siteId ? sites.find(s => s.id === siteId) : null;
      const siteName = selectedSite?.name || "전체";
      const targetYear = year || getKSTYear();
      
      const pdfBuffer = await generateVacationStatusPdf({
        users,
        sites,
        vacations,
        siteId,
        year: targetYear,
      });
      
      const fileName = `휴가현황_${siteName}_${targetYear}년.pdf`;
      
      const success = await sendEmail({
        to: emailAddresses,
        subject: `[휴가현황] ${siteName} - ${targetYear}년`,
        html: `
          <div style="font-family: 'Noto Sans KR', sans-serif; padding: 20px;">
            <h2>휴가현황 발송</h2>
            <p><strong>현장:</strong> ${siteName}</p>
            <p><strong>기간:</strong> ${targetYear}년</p>
            <p><strong>수신:</strong> ${recipientNames}</p>
            <br/>
            <p>첨부된 PDF 파일을 확인해 주세요.</p>
            <br/>
            <p style="color: #666; font-size: 12px;">본 메일은 경비원 근태관리 시스템에서 자동 발송되었습니다.</p>
          </div>
        `,
        attachments: [
          {
            filename: fileName,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
      
      if (success) {
        res.json({ 
          message: `${selectedContacts.length}명에게 이메일을 발송했습니다`,
          recipients: recipientNames
        });
      } else {
        res.status(500).json({ error: "이메일 발송에 실패했습니다" });
      }
    } catch (error) {
      console.error("Send vacation status email error:", error);
      res.status(500).json({ error: "이메일 발송 중 오류가 발생했습니다" });
    }
  });

  return httpServer;
}
