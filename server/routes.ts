import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertSiteSchema, insertDepartmentSchema, insertAttendanceLogSchema, insertVacationRequestSchema, type VacationRequest, type User } from "@shared/schema";
import { z } from "zod";
import { startOfMonth, endOfMonth, format, eachDayOfInterval, parseISO } from "date-fns";
import bcrypt from "bcryptjs";
import { getKSTNow, getKSTToday } from "@shared/kst-utils";
import { calculateAnnualLeave } from "@shared/vacation-calc";
import * as XLSX from "xlsx";

// Helper function to create attendance records for vacation days
async function createVacationAttendanceRecords(vacation: VacationRequest): Promise<void> {
  const user = await storage.getUser(vacation.userId);
  if (!user || !user.siteId) return;

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

async function deleteVacationAttendanceRecords(vacationId: string): Promise<void> {
  await storage.deleteAttendanceLogsByVacationId(vacationId);
}

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "로그인이 필요합니다" });
  }
  next();
}

function requireHqAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "로그인이 필요합니다" });
  }
  if (req.session.role !== "hq_admin") {
    return res.status(403).json({ error: "본사 관리자 권한이 필요합니다" });
  }
  next();
}

function requireSiteManagerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "로그인이 필요합니다" });
  }
  if (req.session.role !== "hq_admin" && req.session.role !== "site_manager") {
    return res.status(403).json({ error: "관리자 권한이 필요합니다" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ============ AUTH ============
  app.post("/api/auth/login", async (req, res) => {
    try {
      const username = String(req.body.username || "").trim();
      const password = String(req.body.password || "").trim();

      if (!username || !password) {
        return res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요" });
      }

      console.log(`Login attempt for username: '${username}'`);
      const matchingUsers = await storage.getUsersByUsername(username);
      console.log(`Found ${matchingUsers.length} matching users`);

      if (matchingUsers.length === 0) {
        return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
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
        return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
      }

      // Check if worker's assigned site is still active
      if (matchedUser.role === "worker" && matchedUser.siteId) {
        const site = await storage.getSite(matchedUser.siteId);
        if (!site || !site.isActive) {
          return res.status(401).json({ error: "배정된 현장이 삭제되었습니다. 관리자에게 문의해주세요." });
        }
      }

      // Masquerade as worker if Site Manager logs in via Name (instead of Site ID)
      // Condition: Role is site_manager AND input username does NOT match stored username (Site ID)
      // This implies input username matched stored Name
      let effectiveRole = matchedUser.role;
      if (matchedUser.role === "site_manager" && matchedUser.username !== username) {
        effectiveRole = "worker";
      }

      req.session.userId = matchedUser.id;
      req.session.role = effectiveRole;
      req.session.siteId = matchedUser.siteId || undefined;

      const { password: _, ...userWithoutPassword } = matchedUser;
      res.json({ user: { ...userWithoutPassword, role: effectiveRole } });
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
      // Use session role if available (for masquerading site managers as workers)
      const effectiveRole = req.session.role || user.role;
      res.json({ user: { ...userWithoutPassword, role: effectiveRole } });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ error: "사용자 정보를 불러오는데 실패했습니다" });
    }
  });

  // ============ USERS ============
  app.get("/api/users", requireSiteManagerOrAdmin, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      let allUsers: User[];

      if (currentUser?.role === "hq_admin") {
        let queryCompany = req.query.company as string;
        // Fallback
        if (!queryCompany && req.url.includes("company=")) {
          try {
            const urlObj = new URL(req.url, "http://localhost");
            queryCompany = urlObj.searchParams.get("company") || "";
          } catch (e) { }
        }

        const targetCompany = queryCompany || currentUser.company;

        if (targetCompany) {
          const allSites = await storage.getSites();
          const companySites = allSites.filter(s => s.company === targetCompany);
          const companySiteIds = companySites.map(s => s.id);

          const users = await storage.getUsers();
          // Filter users who belong to company strictly
          allUsers = users.filter(u => u.company === targetCompany);
        } else {
          allUsers = await storage.getUsers();
        }
      } else if (currentUser?.role === "site_manager" && currentUser.siteId) {
        allUsers = await storage.getUsersBySite(currentUser.siteId);
      } else {
        allUsers = [];
      }

      const safeUsers = allUsers.map(u => {
        const { password, ...userWithoutPassword } = u;
        return userWithoutPassword;
      });

      res.json(safeUsers);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "사용자 목록을 불러오는데 실패했습니다" });
    }
  });

  app.post("/api/users", requireHqAdmin, async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);

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

  // Register site manager (현장대리인)
  app.post("/api/site-managers", requireHqAdmin, async (req, res) => {
    try {
      const { name, phone, siteId } = req.body;
      console.log(`Creating site manager: name=${name}, phone=${phone}, siteId=${siteId}`);

      if (!name || !phone || !siteId) {
        return res.status(400).json({ error: "이름, 전화번호, 현장을 모두 입력해주세요" });
      }

      const site = await storage.getSite(siteId);
      if (!site) {
        console.error(`Site not found: ${siteId}`);
        return res.status(404).json({ error: "현장을 찾을 수 없습니다" });
      }

      // Username = site name, password = last 4 digits of phone
      // Fix: Handle phone numbers with dashes or spaces correctly
      const cleanPhone = phone.replace(/\D/g, "");
      const last4Digits = cleanPhone.slice(-4);

      if (last4Digits.length !== 4) {
        console.error(`Invalid phone number format: ${phone}, extracted: ${last4Digits}`);
        return res.status(400).json({ error: "전화번호 형식이 올바르지 않습니다 (4자리 이상 필요)" });
      }

      console.log(`Generated password (last 4 digits): ${last4Digits}`);

      const hashedPassword = await bcrypt.hash(last4Digits, 10);
      const user = await storage.createUser({
        username: site.name, // Site Manager uses Site Name as ID
        password: hashedPassword,
        name,
        role: "site_manager",
        phone,
        siteId,
        isActive: true,
        company: site.company,
      });

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Create site manager error:", error);
      res.status(500).json({ error: "현장대리인 생성 중 오류가 발생했습니다" });
    }
  });

  // Register worker (근로자)
  app.post("/api/workers", requireSiteManagerOrAdmin, async (req, res) => {
    try {
      const { name, phone, departmentId, hireDate, jobTitle } = req.body;
      const currentUser = await storage.getUser(req.session.userId!);

      if (!name || !phone) {
        return res.status(400).json({ error: "이름과 전화번호를 입력해주세요" });
      }

      let siteId = req.body.siteId;
      if (currentUser?.role === "site_manager") {
        siteId = currentUser.siteId;
      }

      if (!siteId) {
        return res.status(400).json({ error: "현장을 선택해주세요" });
      }

      const last4Digits = phone.replace(/\D/g, "").slice(-4);
      if (last4Digits.length !== 4) {
        return res.status(400).json({ error: "전화번호에서 4자리를 추출할 수 없습니다" });
      }

      const site = await storage.getSite(siteId);
      if (!site) {
        return res.status(404).json({ error: "현장을 찾을 수 없습니다" });
      }

      const hashedPassword = await bcrypt.hash(last4Digits, 10);
      const user = await storage.createUser({
        username: name,
        password: hashedPassword,
        name,
        role: "worker",
        phone,
        siteId,
        departmentId: departmentId || null,
        jobTitle: jobTitle || null,
        hireDate: hireDate || null,
        isActive: true,
        company: site.company,
      });

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Create worker error:", error);
      res.status(500).json({ error: "근로자 등록 중 오류가 발생했습니다" });
    }
  });

  // Excel template download
  app.get("/api/workers/import-template", requireSiteManagerOrAdmin, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      let deptList: string[] = [];

      if (currentUser?.siteId) {
        const depts = await storage.getDepartmentsBySite(currentUser.siteId);
        deptList = depts.map(d => d.name);
      }

      const wb = XLSX.utils.book_new();

      // Main sheet with headers and example
      const wsData = [
        ["이름", "전화번호", "조직", "직책", "입사일"],
        ["홍길동", 1012345678, deptList[0] || "경비", "경비원", new Date("2024-01-15")],
        ["김철수", 1098765432, deptList[1] || "청소", "청소반장", new Date("2024-03-01")],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths
      ws["!cols"] = [
        { wch: 15 }, // 이름
        { wch: 18 }, // 전화번호
        { wch: 15 }, // 조직
        { wch: 15 }, // 직책
        { wch: 15 }, // 입사일
      ];

      // Apply formatting to Phone (Col B, index 1) and Hire Date (Col E, index 4)
      // Loop through first 50 rows (including header=0, data=1..2, empty=3..49)
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1:E50");
      range.e.r = Math.max(range.e.r, 50); // Extend range to row 50
      ws["!ref"] = XLSX.utils.encode_range(range);

      for (let R = 1; R <= 50; ++R) {
        // Phone Column (B -> 1)
        const phoneRef = XLSX.utils.encode_cell({ r: R, c: 1 });
        if (!ws[phoneRef]) ws[phoneRef] = { t: 's', v: "" };
        ws[phoneRef].z = "000-0000-0000";

        // Hire Date Column (E -> 4)
        const dateRef = XLSX.utils.encode_cell({ r: R, c: 4 });
        if (!ws[dateRef]) ws[dateRef] = { t: 's', v: "" };
        ws[dateRef].z = "yyyy-mm-dd";
      }

      XLSX.utils.book_append_sheet(wb, ws, "근로자등록");

      // Departments reference sheet
      if (deptList.length > 0) {
        const deptWsData = [["현장 조직 목록"], ...deptList.map(d => [d])];
        const deptWs = XLSX.utils.aoa_to_sheet(deptWsData);
        XLSX.utils.book_append_sheet(wb, deptWs, "조직목록");
      }

      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=worker_import_template.xlsx");
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Template download error:", error);
      res.status(500).json({ error: "양식 다운로드 중 오류가 발생했습니다" });
    }
  });

  // Excel bulk import
  app.post("/api/workers/bulk-import", requireSiteManagerOrAdmin, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);

      let siteId = req.body.siteId;
      if (currentUser?.role === "site_manager") {
        siteId = currentUser.siteId;
      }

      if (!siteId) {
        return res.status(400).json({ error: "현장이 지정되지 않았습니다" });
      }



      // Get site info once
      const site = await storage.getSite(siteId);
      if (!site) {
        return res.status(404).json({ error: "현장을 찾을 수 없습니다" });
      }

      const { data } = req.body; // Array of { name, phone, department, jobTitle, hireDate }
      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ error: "등록할 근로자 데이터가 없습니다" });
      }

      // Get departments for this site
      const departments = await storage.getDepartmentsBySite(siteId);
      const deptMap = new Map(departments.map(d => [d.name, d.id]));

      const results = { success: 0, failed: 0, errors: [] as string[] };

      for (let i = 0; i < data.length; i++) {
        try {
          const row = data[i];
          const name = String(row.name || "").trim();
          const phone = String(row.phone || "").trim();
          const deptName = String(row.department || "").trim();
          const jobTitle = row.jobTitle ? String(row.jobTitle).trim() : null;
          const hireDate = row.hireDate ? String(row.hireDate).trim() : null;

          if (!name || !phone) {
            results.failed++;
            results.errors.push(`${i + 1}행: 이름 또는 전화번호가 비어있습니다`);
            continue;
          }

          const last4Digits = phone.replace(/\D/g, "").slice(-4);
          if (last4Digits.length !== 4) {
            results.failed++;
            results.errors.push(`${i + 1}행: 전화번호가 올바르지 않습니다 (${name})`);
            continue;
          }

          const departmentId = deptMap.get(deptName) || null;

          const hashedPassword = await bcrypt.hash(last4Digits, 10);
          await storage.createUser({
            username: name,
            password: hashedPassword,
            name,
            role: "worker",
            phone,
            siteId,
            departmentId,
            jobTitle,
            hireDate,
            isActive: true,
            company: site.company,
          });

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`${i + 1}행: 등록 실패 - ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
        }
      }

      res.json({
        message: `${results.success}명 등록 완료, ${results.failed}명 실패`,
        ...results,
      });
    } catch (error) {
      console.error("Bulk import error:", error);
      res.status(500).json({ error: "일괄 등록 중 오류가 발생했습니다" });
    }
  });

  app.patch("/api/users/:id/toggle-active", requireSiteManagerOrAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      const updated = await storage.updateUser(id, { isActive: !user.isActive });
      const { password: _, ...userWithoutPassword } = updated as any; // Type assertion since updateUser return might not enforce strict schema here
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Toggle active error:", error);
      res.status(500).json({ error: "상태 변경 중 오류가 발생했습니다" });
    }
  });

  app.patch("/api/users/:id", requireSiteManagerOrAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone, hireDate, siteId, departmentId, isActive, jobTitle } = req.body;

      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) {
        updateData.phone = phone;
        const last4Digits = phone.replace(/\D/g, "").slice(-4);
        if (last4Digits.length === 4) {
          updateData.password = await bcrypt.hash(last4Digits, 10);
        }
      }

      if (hireDate !== undefined) {
        updateData.hireDate = hireDate === "" ? null : hireDate;
      }
      if (siteId !== undefined) {
        updateData.siteId = siteId;
        // If site changes, update company to match new site
        const site = await storage.getSite(siteId);
        if (site) {
          updateData.company = site.company;
          // Site managers always use site name as username
          if (user.role === "site_manager" || req.body.role === "site_manager") {
            updateData.username = site.name;
          }
        }
      }
      // Ensure site managers keep site name as username (even without site change)
      if ((user.role === "site_manager" || req.body.role === "site_manager") && !updateData.username) {
        const currentSiteId = siteId || user.siteId;
        if (currentSiteId) {
          const site = await storage.getSite(currentSiteId);
          if (site) {
            updateData.username = site.name;
          }
        }
      }
      if (departmentId !== undefined) {
        updateData.departmentId = departmentId === "none" || departmentId === "" ? null : departmentId;
      }
      if (jobTitle !== undefined) {
        updateData.jobTitle = jobTitle === "" ? null : jobTitle;
      }
      if (isActive !== undefined) updateData.isActive = isActive;
      if (req.body.role !== undefined) updateData.role = req.body.role;

      console.log("Updating user:", id, updateData);
      const updatedUser = await storage.updateUser(id, updateData);
      const { password: _, ...userWithoutPassword } = updatedUser as any;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update user error full object:", JSON.stringify(error, null, 2));
      res.status(500).json({ error: "사용자 수정 중 오류가 발생했습니다" });
    }
  });

  app.delete("/api/users/:id", requireSiteManagerOrAdmin, async (req, res) => {
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

  // ============ SITES ============
  app.get("/api/sites", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      let sites = await storage.getSites();

      if (currentUser?.role === "hq_admin") {
        // Allow querying by specific company if provided, otherwise default to user's company
        let queryCompany = req.query.company as string;

        // Fallback: manually parse URL if req.query is empty (belt and suspenders)
        if (!queryCompany && req.url.includes("company=")) {
          try {
            const urlObj = new URL(req.url, "http://localhost");
            queryCompany = urlObj.searchParams.get("company") || "";
          } catch (e) {
            console.error("Manual URL parsing failed", e);
          }
        }

        const targetCompany = queryCompany || currentUser.company;

        // Special Case: 'dawon' admin should ONLY see 'dawon_pmc' sites
        // 'admin' (mirae_abm) can see everything or switch context
        if (currentUser.username !== "admin" && currentUser.username !== "관리자" && currentUser.company) {
          sites = sites.filter(s => s.company === currentUser.company);
        } else if (targetCompany) {
          sites = sites.filter(s => s.company === targetCompany);
        }
      } else if ((currentUser?.role === "site_manager" || currentUser?.role === "worker") && currentUser.siteId) {
        sites = sites.filter(s => s.id === currentUser.siteId);
      } else {
        sites = [];
      }

      res.json(sites);
    } catch (error) {
      console.error("Get sites error:", error);
      res.status(500).json({ error: "현장 목록을 불러오는데 실패했습니다" });
    }
  });


  app.post("/api/sites", requireHqAdmin, async (req, res) => {
    try {
      const { name, address, contractStartDate, contractEndDate, departments: deptNames, company } = req.body;
      const currentUser = await storage.getUser(req.session.userId!);

      if (!name) {
        return res.status(400).json({ error: "현장명을 입력해주세요" });
      }

      // If company is provided, use it (allow HQ admin to create for any company).
      // Otherwise default to admin's company or mirae_abm.
      const siteCompany = company || currentUser?.company || "mirae_abm";

      const site = await storage.createSite({
        name,
        address: address || null,
        contractStartDate: contractStartDate || null,
        contractEndDate: contractEndDate || null,
        isActive: true,
        company: siteCompany,
        managerEmail: req.body.managerEmail || null,
      });

      // Create departments if provided
      if (Array.isArray(deptNames) && deptNames.length > 0) {
        for (let i = 0; i < deptNames.length; i++) {
          const deptName = String(deptNames[i]).trim();
          if (deptName) {
            await storage.createDepartment({
              siteId: site.id,
              name: deptName,
              sortOrder: i,
              isActive: true,
            });
          }
        }
      }

      res.status(201).json(site);
    } catch (error) {
      console.error("Create site error:", error);
      res.status(500).json({ error: "현장 생성 중 오류가 발생했습니다" });
    }
  });

  app.patch("/api/sites/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, address, contractStartDate, contractEndDate, company, isActive } = req.body;
      const currentUser = await storage.getUser(req.session.userId!);

      if (!currentUser) return res.sendStatus(401);

      // Permission check
      const isHqAdmin = currentUser.role === "hq_admin";
      const isSiteManager = currentUser.role === "site_manager";

      // Site Managers can only update their own site
      if (isSiteManager && currentUser.siteId !== id) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }

      // Workers cannot update sites
      if (currentUser.role === "worker") {
        return res.status(403).json({ error: "권한이 없습니다" });
      }

      const updateData: any = {};

      // HQ Admin can update everything
      if (isHqAdmin) {
        if (name !== undefined) updateData.name = name;
        if (address !== undefined) updateData.address = address;
        if (contractStartDate !== undefined) updateData.contractStartDate = contractStartDate;
        if (contractEndDate !== undefined) updateData.contractEndDate = contractEndDate;
        if (company !== undefined) updateData.company = company;
        if (isActive !== undefined) updateData.isActive = isActive;
      }

      // Both HQ Admin and Site Manager can update managerEmail
      if (req.body.managerEmail !== undefined) {
        updateData.managerEmail = req.body.managerEmail;
      }

      const site = await storage.updateSite(id, updateData);
      if (!site) {
        return res.status(404).json({ error: "현장을 찾을 수 없습니다" });
      }

      // If site name changed, update all site managers' usernames
      // Only HQ Admin can change name, so this logic is safe/conditional
      if (isHqAdmin && name !== undefined) {
        const siteUsers = await storage.getUsersBySite(id);
        const siteManagers = siteUsers.filter(u => u.role === "site_manager");
        for (const manager of siteManagers) {
          await storage.updateUser(manager.id, { username: name });
        }
      }

      res.json(site);
    } catch (error) {
      console.error("Update site error:", error);
      res.status(500).json({ error: "현장 수정 중 오류가 발생했습니다" });
    }
  });

  app.delete("/api/sites/:id", requireHqAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSite(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete site error:", error);
      res.status(500).json({ error: "현장 삭제 중 오류가 발생했습니다" });
    }
  });


  // ============ DEPARTMENTS ============
  app.get("/api/departments/:siteId", requireAuth, async (req, res) => {
    try {
      const { siteId } = req.params;
      const depts = await storage.getDepartmentsBySite(siteId);
      res.json(depts);
    } catch (error) {
      console.error("Get deps error:", error);
      res.status(500).json({ error: "부서 목록을 불러오는데 실패했습니다" });
    }
  });

  // Departments
  app.get("/api/departments", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      let departments = await storage.getAllDepartments();

      if (currentUser?.role === "hq_admin") {
        // Allow querying by specific company if provided, otherwise default to user's company
        let queryCompany = req.query.company as string;
        // Fallback
        if (!queryCompany && req.url.includes("company=")) {
          try {
            const urlObj = new URL(req.url, "http://localhost");
            queryCompany = urlObj.searchParams.get("company") || "";
          } catch (e) { }
        }

        const targetCompany = queryCompany || currentUser.company;

        if (targetCompany) {
          const sites = await storage.getSites();
          const companySites = sites.filter(s => s.company === targetCompany);
          const companySiteIds = companySites.map(s => s.id);
          departments = departments.filter(d => companySiteIds.includes(d.siteId));
        }
      } else if (currentUser?.role === "site_manager" && currentUser.siteId) {
        departments = departments.filter(d => d.siteId === currentUser.siteId);
      }

      res.json(departments);
    } catch (error) {
      console.error("Get all departments error:", error);
      res.status(500).json({ error: "전체 부서 목록을 불러오는데 실패했습니다" });
    }
  });

  app.post("/api/departments/site/:siteId", requireHqAdmin, async (req, res) => {
    try {
      const { siteId, name, sortOrder } = req.body;
      if (!siteId || !name) {
        return res.status(400).json({ error: "현장과 조직명을 입력해주세요" });
      }

      const dept = await storage.createDepartment({
        siteId,
        name,
        sortOrder: sortOrder || 0,
        isActive: true,
      });
      res.status(201).json(dept);
    } catch (error) {
      console.error("Create department error:", error);
      res.status(500).json({ error: "조직 생성 중 오류가 발생했습니다" });
    }
  });

  app.patch("/api/departments/:id", requireHqAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, sortOrder } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

      const dept = await storage.updateDepartment(id, updateData);
      if (!dept) {
        return res.status(404).json({ error: "조직을 찾을 수 없습니다" });
      }
      res.json(dept);
    } catch (error) {
      console.error("Update department error:", error);
      res.status(500).json({ error: "조직 수정 중 오류가 발생했습니다" });
    }
  });

  app.delete("/api/departments/:id", requireHqAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteDepartment(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete department error:", error);
      res.status(500).json({ error: "조직 삭제 중 오류가 발생했습니다" });
    }
  });

  // ============ ATTENDANCE ============
  app.get("/api/attendance", requireSiteManagerOrAdmin, async (req, res) => {
    try {
      const { month, siteId } = req.query;

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

      const currentUser = await storage.getUser(req.session.userId!);
      let logs;

      if (siteId && typeof siteId === "string") {
        logs = await storage.getAttendanceLogsBySite(siteId, startDate, endDate);
      } else if (currentUser?.role === "site_manager" && currentUser.siteId) {
        logs = await storage.getAttendanceLogsBySite(currentUser.siteId, startDate, endDate);
      } else if (currentUser?.role === "hq_admin") {
        let queryCompany = req.query.company as string;
        // Fallback
        if (!queryCompany && req.url.includes("company=")) {
          try {
            const urlObj = new URL(req.url, "http://localhost");
            queryCompany = urlObj.searchParams.get("company") || "";
          } catch (e) { }
        }

        const targetCompany = queryCompany || currentUser.company;

        // If filtering by company, we need to get sites for that company first
        if (targetCompany) {
          const sites = await storage.getSites(); // Get all sites
          const companySites = sites.filter(s => s.company === targetCompany);
          const companySiteIds = companySites.map(s => s.id);

          // Get all logs for the period (optimization: could add DB filter)
          const allLogs = await storage.getAttendanceLogs(startDate, endDate);
          logs = allLogs.filter(log => companySiteIds.includes(log.siteId));
        } else {
          logs = await storage.getAttendanceLogs(startDate, endDate);
        }
      } else {
        logs = await storage.getAttendanceLogs(startDate, endDate);
      }

      res.json(logs);
    } catch (error) {
      console.error("Get attendance error:", error);
      res.status(500).json({ error: "출근 기록을 불러오는데 실패했습니다" });
    }
  });

  app.get("/api/attendance/today/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;

      if (req.session.role === "worker" && req.session.userId !== userId) {
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

  app.get("/api/attendance/active/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;

      if (req.session.role === "worker" && req.session.userId !== userId) {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }

      const log = await storage.getLatestIncompleteAttendanceLog(userId);
      res.json(log || null);
    } catch (error) {
      console.error("Get active attendance error:", error);
      res.status(500).json({ error: "진행 중인 출근 기록을 불러오는데 실패했습니다" });
    }
  });

  app.get("/api/attendance/user/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { month } = req.query;

      if (req.session.role === "worker" && req.session.userId !== userId) {
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
      const { siteId, checkInDate, latitude, longitude, action = "in" } = req.body;
      const userId = req.session.userId!;

      if (!siteId || !checkInDate) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }

      const site = await storage.getSite(siteId);
      if (!site) {
        return res.status(404).json({ error: "현장을 찾을 수 없습니다" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      }

      if (!user.siteId) {
        return res.status(400).json({ error: "배정된 현장이 없습니다. 관리자에게 문의하세요." });
      }

      if (user.siteId !== siteId) {
        console.log(`[CheckIn Mismatch] User: ${user.name} (${userId}), Role: ${user.role}`);
        console.log(`[CheckIn Mismatch] User SiteID: '${user.siteId}'`);
        console.log(`[CheckIn Mismatch] Req SiteID:  '${siteId}'`);
        console.log(`[CheckIn Mismatch] Site Name:   '${site.name}'`);

        // Check if there is ANOTHER account for this person (Same Name, Same Phone) that matches the siteId
        const alternativeUser = await storage.findUserByNamePhoneAndSite(user.name, user.phone, siteId);

        if (alternativeUser) {
          console.log(`[CheckIn Switch] Found alternative user account ${alternativeUser.id} for site ${site.name}. Switching session.`);

          // Switch Session
          req.session.userId = alternativeUser.id;
          req.session.role = "worker"; // Keep them as worker (masquerading)

          if (action === "out") {
            const latestIncomplete = await storage.getLatestIncompleteAttendanceLog(alternativeUser.id);
            if (!latestIncomplete) {
              return res.status(400).json({ error: "퇴근 처리를 할 수 있는 이전 출근 기록이 없습니다." });
            }
            const updatedLog = await storage.updateAttendanceLog(latestIncomplete.id, {
              checkOutTime: new Date()
            });
            return res.status(200).json({ ...updatedLog, siteName: site.name });
          } else {
            const existingLog = await storage.getTodayAttendanceLog(alternativeUser.id, checkInDate);
            if (existingLog && !existingLog.checkOutTime) {
              return res.status(400).json({ error: "현재 출근 중입니다. 먼저 퇴근을 진행해주세요." });
            }

            const log = await storage.createAttendanceLog({
              userId: alternativeUser.id,
              siteId,
              checkInDate,
              latitude: latitude || null,
              longitude: longitude || null,
              source: "qr",
            });

            return res.status(201).json({ ...log, siteName: site.name });
          }
        }

        return res.status(400).json({ error: `본인 현장(${site.name})이 아닌 다른 현장의 QR 코드입니다.` });
      }

      if (action === "out") {
        const latestIncomplete = await storage.getLatestIncompleteAttendanceLog(userId);
        if (!latestIncomplete) {
          return res.status(400).json({ error: "퇴근 처리를 할 수 있는 이전 출근 기록이 없습니다." });
        }

        const updatedLog = await storage.updateAttendanceLog(latestIncomplete.id, {
          checkOutTime: new Date()
        });
        return res.status(200).json({ ...updatedLog, siteName: site.name });
      } else {
        const existingLog = await storage.getTodayAttendanceLog(userId, checkInDate);
        if (existingLog && !existingLog.checkOutTime) {
          return res.status(400).json({ error: "현재 출근 중입니다. 먼저 퇴근을 진행해주세요." });
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
      }
    } catch (error) {
      console.error("Check-in error:", error);
      res.status(500).json({ error: "출퇴근 처리 중 오류가 발생했습니다" });
    }
  });

  const validAttendanceTypes = ["normal", "normal_out", "annual", "half_day", "sick", "family_event", "other"] as const;

  app.post("/api/admin/attendance", requireSiteManagerOrAdmin, async (req, res) => {
    try {
      const { userId, siteId, checkInDate, attendanceType } = req.body;

      if (!userId || !siteId || !checkInDate) {
        return res.status(400).json({ error: "필수 정보가 누락되었습니다" });
      }

      const resolvedType = attendanceType || "normal";
      if (!validAttendanceTypes.includes(resolvedType)) {
        return res.status(400).json({ error: "유효하지 않은 출근/휴가 유형입니다" });
      }

      const baseType = resolvedType === "normal_out" ? "normal" : resolvedType;
      const existingLog = await storage.getAttendanceLogByUserAndDate(userId, checkInDate);

      if (resolvedType === "normal_out") {
        if (existingLog) {
          const updated = await storage.updateAttendanceLog(existingLog.id, {
            checkOutTime: new Date(checkInDate),
            source: "manual"
          });
          return res.status(200).json(updated);
        } else {
          // If no check-in exists, create one with both in and out times so it shows as completed (Blue O)
          const log = await storage.createAttendanceLog({
            userId,
            siteId,
            checkInDate,
            latitude: null,
            longitude: null,
            attendanceType: baseType,
            source: "manual",
          });
          const updatedLog = await storage.updateAttendanceLog(log.id, {
            checkOutTime: new Date(checkInDate)
          });
          return res.status(201).json(updatedLog);
        }
      }

      if (existingLog) {
        return res.status(400).json({ error: "해당 날짜에 이미 출근 기록이 있습니다" });
      }

      const log = await storage.createAttendanceLog({
        userId,
        siteId,
        checkInDate,
        latitude: null,
        longitude: null,
        attendanceType: baseType,
        source: "manual",
      });

      res.status(201).json(log);
    } catch (error) {
      console.error("Admin create attendance error:", error);
      res.status(500).json({ error: "출근 기록 생성 중 오류가 발생했습니다" });
    }
  });

  app.patch("/api/admin/attendance", requireSiteManagerOrAdmin, async (req, res) => {
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

      const baseType = attendanceType === "normal_out" ? "normal" : attendanceType;
      const updateData: any = { attendanceType: baseType };
      if (existingLog.source !== "vacation") {
        updateData.source = "manual";
      }

      if (attendanceType === "normal_out") {
        updateData.checkOutTime = new Date(checkInDate);
      } else if (attendanceType === "normal") {
        updateData.checkOutTime = null; // Reset to in_only if they switch back to just "출근(O)"
      }

      const updated = await storage.updateAttendanceLog(existingLog.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Admin update attendance error:", error);
      res.status(500).json({ error: "출근 기록 수정 중 오류가 발생했습니다" });
    }
  });

  app.delete("/api/admin/attendance", requireSiteManagerOrAdmin, async (req, res) => {
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

  // ============ VACATION BALANCE ============
  app.get("/api/vacation-balance", requireSiteManagerOrAdmin, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) return res.status(401).json({ error: "인증 필요" });

      let siteId: string | undefined;

      if (currentUser.role === "hq_admin") {
        siteId = req.query.siteId as string;
        if (!siteId) return res.status(400).json({ error: "현장을 선택해주세요" });
      } else if (currentUser.role === "site_manager") {
        siteId = currentUser.siteId || undefined;
        if (!siteId) return res.status(400).json({ error: "배정된 현장이 없습니다" });
      }

      const queryYear = parseInt(req.query.year as string) || new Date().getFullYear();

      // Get site info
      const sites = await storage.getSites();
      const site = sites.find(s => s.id === siteId);
      const siteName = site?.name || "-";

      // Get workers at this site (workers + site managers are both employees)
      const allUsers = await storage.getUsers();
      const siteWorkers = allUsers.filter(u => u.siteId === siteId && u.isActive && (u.role === "worker" || u.role === "site_manager"));


      // Get all vacation requests for these workers
      const allRequests = await storage.getVacationRequests();
      const today = getKSTToday();

      const balances = siteWorkers.map(worker => {
        const entitlement = calculateAnnualLeave(worker.hireDate || today, today);

        // Filter approved requests within the current entitlement period
        const approvedRequests = allRequests.filter(r => {
          if (r.userId !== worker.id || r.status !== "approved") return false;
          if (entitlement.periodStart && entitlement.periodEnd) {
            return r.startDate >= entitlement.periodStart && r.startDate < entitlement.periodEnd;
          }
          return true;
        });

        // Filter pending requests
        const pendingRequests = allRequests.filter(r =>
          r.userId === worker.id && r.status === "pending"
        );

        const usedDays = approvedRequests.reduce((sum, r) => sum + (r.days || 0), 0);
        const pendingDays = pendingRequests.reduce((sum, r) => sum + (r.days || 0), 0);
        const remainingDays = entitlement.totalDays - usedDays;

        // Vacation history: list of approved vacation date ranges
        const vacationHistory = approvedRequests.map(r => ({
          id: r.id,
          startDate: r.startDate,
          endDate: r.endDate,
          type: r.vacationType,
          days: r.days,
          reason: r.reason,
        }));

        return {
          userId: worker.id,
          name: worker.name,
          siteName,
          jobTitle: worker.jobTitle || "-",
          hireDate: worker.hireDate || null,
          yearsWorked: entitlement.yearsWorked,
          monthsWorked: entitlement.monthsWorked,
          totalEntitlement: entitlement.totalDays,
          usedDays,
          remainingDays,
          pendingDays,
          pendingCount: pendingRequests.length,
          vacationHistory,
          description: entitlement.description,
          periodStart: entitlement.periodStart,
          periodEnd: entitlement.periodEnd,
        };
      });

      res.json(balances);
    } catch (error) {
      console.error("Get vacation balance error:", error);
      res.status(500).json({ error: "휴가 현황을 불러오는데 실패했습니다" });
    }
  });

  // ============ VACATION ============
  app.get("/api/vacation-requests", requireSiteManagerOrAdmin, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      let requests: VacationRequest[];

      if (currentUser?.role === "hq_admin") {
        let queryCompany = req.query.company as string;
        const querySiteId = req.query.siteId as string;
        // Fallback
        if (!queryCompany && req.url.includes("company=")) {
          try {
            const urlObj = new URL(req.url, "http://localhost");
            queryCompany = urlObj.searchParams.get("company") || "";
          } catch (e) { }
        }
        const targetCompany = queryCompany || currentUser.company;

        requests = await storage.getVacationRequests();

        if (targetCompany) {
          const users = await storage.getUsers();
          let filteredUsers = users.filter(u => u.company === targetCompany);
          // If siteId is specified, further filter by site
          if (querySiteId) {
            filteredUsers = filteredUsers.filter(u => u.siteId === querySiteId);
          }
          const filteredUserIds = filteredUsers.map(u => u.id);
          requests = requests.filter(r => filteredUserIds.includes(r.userId));
        }
      } else if (currentUser?.role === "site_manager" && currentUser.siteId) {
        requests = await storage.getVacationRequestsBySite(currentUser.siteId);
      } else {
        requests = [];
      }

      res.json(requests);
    } catch (error) {
      console.error("Get vacation requests error:", error);
      res.status(500).json({ error: "휴가 신청 목록을 불러오는데 실패했습니다" });
    }
  });

  app.get("/api/vacation-requests/user/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      if (req.session.role === "worker" && req.session.userId !== userId) {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }
      const requests = await storage.getVacationRequestsByUser(userId);
      res.json(requests);
    } catch (error) {
      console.error("Get user vacation requests error:", error);
      res.status(500).json({ error: "휴가 신청 목록을 불러오는데 실패했습니다" });
    }
  });

  app.post("/api/vacation-requests", requireAuth, async (req, res) => {
    try {
      const validatedData = insertVacationRequestSchema.parse(req.body);
      const request = await storage.createVacationRequest(validatedData);
      res.status(201).json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Create vacation request error:", error);
      res.status(500).json({ error: "휴가 신청 중 오류가 발생했습니다" });
    }
  });

  app.patch("/api/vacation-requests/:id", requireSiteManagerOrAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      // Allow full updates (status, dates, type, reason)
      const { status, rejectionReason, startDate, endDate, vacationType, reason, days } = req.body;

      const updateData: any = {};

      // Status update logic
      if (status) {
        updateData.status = status;
        if (status === "approved" || status === "rejected") {
          updateData.respondedBy = req.session.userId;
          updateData.respondedAt = new Date();
        }
      }

      if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason;

      // Edit fields logic
      if (startDate) updateData.startDate = startDate;
      if (endDate) updateData.endDate = endDate;
      if (vacationType) updateData.vacationType = vacationType;
      if (reason !== undefined) updateData.reason = reason;
      if (days !== undefined) updateData.days = days;

      // Get existing request to check previous status/dates
      const existingRequest = await storage.getVacationRequest(id);

      const request = await storage.updateVacationRequest(id, updateData);
      if (!request) {
        return res.status(404).json({ error: "휴가 신청을 찾을 수 없습니다" });
      }

      // Attendance Log Sync Logic
      // If approved (or remaining approved after edit), sync attendance
      const finalStatus = status || existingRequest?.status;

      if (finalStatus === "approved") {
        // If it was already confirmed, we might need to recreate logs if dates changed
        // Safest approach: Delete existing logs for this request, then create new ones
        await deleteVacationAttendanceRecords(id);
        await createVacationAttendanceRecords(request);
      } else if (finalStatus === "rejected") {
        await deleteVacationAttendanceRecords(id);
      }
      // If pending, do nothing (or delete if it was previously approved? - "pending" usually means reset? But users rarely revert Approved to Pending. If they do, logs should be removed.)
      else if (finalStatus === "pending") {
        await deleteVacationAttendanceRecords(id);
      }

      res.json(request);
    } catch (error) {
      console.error("Update vacation request error:", error);
      res.status(500).json({ error: "휴가 처리 중 오류가 발생했습니다" });
    }
  });

  app.delete("/api/vacation-requests/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const request = await storage.getVacationRequest(id);
      if (!request) return res.status(404).json({ error: "요청을 찾을 수 없습니다" });

      if (req.session.role !== "hq_admin" && req.session.role !== "site_manager") {
        if (request.userId !== req.session.userId) {
          return res.status(403).json({ error: "삭제 권한이 없습니다" });
        }
        if (request.status !== "pending") {
          return res.status(400).json({ error: "대기 중인 요청만 삭제할 수 있습니다" });
        }
      }

      await deleteVacationAttendanceRecords(id);
      await storage.deleteVacationRequest(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete vacation request error:", error);
      res.status(500).json({ error: "휴가 삭제 중 오류가 발생했습니다" });
    }
  });

  // ============ SEED DATA ============
  app.post("/api/seed", async (req, res) => {
    try {
      const existingUsers = await storage.getUsers();
      if (existingUsers.length > 0) {
        return res.json({ message: "이미 초기 데이터가 있습니다", seeded: false });
      }

      const adminPassword = await bcrypt.hash("admin123", 10);

      const admin = await storage.createUser({
        username: "관리자",
        password: adminPassword,
        name: "관리자",
        role: "hq_admin",
        phone: "010-0000-0000",
        isActive: true,
      });

      res.json({
        message: "초기 데이터가 생성되었습니다 (본사 관리자 계정)",
        seeded: true,
        data: {
          admin: { ...admin, password: undefined },
        },
      });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ error: "초기 데이터 생성 중 오류가 발생했습니다" });
    }
  });

  // ============ QR CODE ============
  app.post("/api/sites/:id/qr", requireHqAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const site = await storage.getSite(id);
      if (!site) {
        return res.status(404).json({ error: "현장을 찾을 수 없습니다" });
      }

      const qrDataIn = JSON.stringify({ action: "in", type: "attendance", siteId: id });
      const qrDataOut = JSON.stringify({ action: "out", type: "attendance", siteId: id });
      const updated = await storage.updateSite(id, { qrCode: qrDataIn, qrCodeOut: qrDataOut });
      res.json(updated);
    } catch (error) {
      console.error("Generate QR error:", error);
      res.status(500).json({ error: "QR 코드 생성 중 오류가 발생했습니다" });
    }
  });


  // ============ EMAIL ============
  app.post("/api/email/send", requireAuth, async (req, res) => {
    try {
      const { to, subject, html } = req.body;

      // Basic validation
      if (!to || !subject || !html) {
        return res.status(400).json({ error: "Missing required fields: to, subject, html" });
      }

      // Check for credentials
      if (!process.env.NODEMAILER_USER || !process.env.NODEMAILER_PASS) {
        console.warn("Email credentials missing. Simulating email send.");
        return res.json({ message: "Email simulated (credentials missing)", simulated: true });
      }

      let transporter;
      if (process.env.SMTP_HOST) {
        transporter = ((await import("nodemailer")).default).createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
          auth: {
            user: process.env.NODEMAILER_USER,
            pass: process.env.NODEMAILER_PASS,
          },
        });
      } else {
        transporter = ((await import("nodemailer")).default).createTransport({
          service: "gmail",
          auth: {
            user: process.env.NODEMAILER_USER,
            pass: process.env.NODEMAILER_PASS,
          },
        });
      }

      const currentUser = await storage.getUser(req.session.userId!);
      let senderName = "관리자";
      const companyVal = currentUser?.company as string;
      if (companyVal === "mirae_abm" || companyVal === "미래에이비엠") {
        senderName = "미래에이비엠";
      } else if (companyVal === "dawon_pmc" || companyVal === "다원피엠씨") {
        senderName = "다원피엠씨";
      } else if (companyVal) {
        senderName = companyVal;
      }
      const fromAddress = `"${senderName}" <${process.env.NODEMAILER_USER}>`;

      const info = await transporter.sendMail({
        from: fromAddress, // sender address
        to, // list of receivers
        subject, // Subject line
        html, // html body
        attachments: req.body.attachments, // attachments
      });

      console.log("Message sent: %s", info.messageId);
      res.json({ message: "Email sent successfully", messageId: info.messageId });

    } catch (error) {
      console.error("Email send error:", error);
      res.status(500).json({ error: "이메일 전송 중 오류가 발생했습니다" });
    }
  });




  return httpServer;
}
