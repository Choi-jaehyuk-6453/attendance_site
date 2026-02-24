import {
  users,
  sites,
  departments,
  attendanceLogs,
  vacationRequests,
  type User,
  type InsertUser,
  type Site,
  type InsertSite,
  type Department,
  type InsertDepartment,
  type AttendanceLog,
  type InsertAttendanceLog,
  type VacationRequest,
  type InsertVacationRequest,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql, asc, or } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsersByUsername(username: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  getUsersBySite(siteId: string): Promise<User[]>;
  getUsersByDepartment(departmentId: string): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  findUserByNamePhoneAndSite(name: string, phone: string | null, siteId: string): Promise<User | undefined>;

  // Sites
  getSite(id: string): Promise<Site | undefined>;
  getSiteByName(name: string): Promise<Site | undefined>;
  getSites(): Promise<Site[]>;
  createSite(site: InsertSite): Promise<Site>;
  updateSite(id: string, data: Partial<InsertSite>): Promise<Site | undefined>;
  deleteSite(id: string): Promise<void>;

  // Departments
  getDepartment(id: string): Promise<Department | undefined>;
  getDepartmentsBySite(siteId: string): Promise<Department[]>;
  getAllDepartments(): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(id: string, data: Partial<InsertDepartment>): Promise<Department | undefined>;
  deleteDepartment(id: string): Promise<void>;

  // Attendance
  getAttendanceLog(id: string): Promise<AttendanceLog | undefined>;
  getAttendanceLogs(startDate?: string, endDate?: string): Promise<AttendanceLog[]>;
  getAttendanceLogsBySite(siteId: string, startDate?: string, endDate?: string): Promise<AttendanceLog[]>;
  getAttendanceLogsByUser(userId: string, startDate?: string, endDate?: string): Promise<AttendanceLog[]>;
  getTodayAttendanceLog(userId: string, date: string): Promise<AttendanceLog | undefined>;
  getAttendanceLogByUserAndDate(userId: string, date: string): Promise<AttendanceLog | undefined>;
  getLatestIncompleteAttendanceLog(userId: string): Promise<AttendanceLog | undefined>;
  createAttendanceLog(log: InsertAttendanceLog): Promise<AttendanceLog>;
  updateAttendanceLog(id: string, data: Partial<AttendanceLog>): Promise<AttendanceLog | undefined>;
  deleteAttendanceLog(id: string): Promise<void>;
  deleteAttendanceLogByUserAndDate(userId: string, date: string): Promise<void>;
  deleteAttendanceLogsByVacationId(vacationId: string): Promise<void>;

  // Vacation
  getVacationRequests(): Promise<VacationRequest[]>;
  getVacationRequest(id: string): Promise<VacationRequest | undefined>;
  getVacationRequestsByUser(userId: string): Promise<VacationRequest[]>;
  getVacationRequestsBySite(siteId: string): Promise<VacationRequest[]>;
  createVacationRequest(request: InsertVacationRequest): Promise<VacationRequest>;
  updateVacationRequest(id: string, data: Partial<VacationRequest>): Promise<VacationRequest | undefined>;
  deleteVacationRequest(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // === Users ===
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUsersByUsername(username: string): Promise<User[]> {
    return db.select().from(users).where(
      and(
        or(eq(users.username, username), eq(users.name, username)),
        eq(users.isActive, true)
      )
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUsersBySite(siteId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.siteId, siteId));
  }

  async getUsersByDepartment(departmentId: string): Promise<User[]> {
    return db.select().from(users).where(
      and(eq(users.departmentId, departmentId), eq(users.isActive, true))
    );
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(attendanceLogs).where(eq(attendanceLogs.userId, id));
    await db.delete(vacationRequests).where(eq(vacationRequests.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async findUserByNamePhoneAndSite(name: string, phone: string | null, siteId: string): Promise<User | undefined> {
    const conditions = [
      eq(users.name, name),
      eq(users.siteId, siteId),
      eq(users.isActive, true)
    ];

    if (phone) {
      conditions.push(eq(users.phone, phone));
    }

    const [user] = await db.select().from(users).where(and(...conditions));
    return user || undefined;
  }

  // === Sites ===
  async getSite(id: string): Promise<Site | undefined> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id));
    return site || undefined;
  }

  async getSiteByName(name: string): Promise<Site | undefined> {
    const [site] = await db.select().from(sites).where(eq(sites.name, name));
    return site || undefined;
  }

  async getSites(): Promise<Site[]> {
    return db.select().from(sites).where(eq(sites.isActive, true));
  }

  async createSite(insertSite: InsertSite): Promise<Site> {
    const [site] = await db.insert(sites).values(insertSite).returning();
    return site;
  }

  async updateSite(id: string, data: Partial<InsertSite>): Promise<Site | undefined> {
    const [site] = await db.update(sites).set(data).where(eq(sites.id, id)).returning();
    return site || undefined;
  }

  async deleteSite(id: string): Promise<void> {
    await db.update(sites).set({ isActive: false }).where(eq(sites.id, id));
  }

  // === Departments ===
  async getDepartment(id: string): Promise<Department | undefined> {
    const [dept] = await db.select().from(departments).where(eq(departments.id, id));
    return dept || undefined;
  }

  async getDepartmentsBySite(siteId: string): Promise<Department[]> {
    return db.select().from(departments).where(
      and(eq(departments.siteId, siteId), eq(departments.isActive, true))
    ).orderBy(asc(departments.sortOrder));
  }

  async getAllDepartments(): Promise<Department[]> {
    return db.select().from(departments).where(eq(departments.isActive, true));
  }

  async createDepartment(insertDept: InsertDepartment): Promise<Department> {
    const [dept] = await db.insert(departments).values(insertDept).returning();
    return dept;
  }

  async updateDepartment(id: string, data: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [dept] = await db.update(departments).set(data).where(eq(departments.id, id)).returning();
    return dept || undefined;
  }

  async deleteDepartment(id: string): Promise<void> {
    await db.update(departments).set({ isActive: false }).where(eq(departments.id, id));
  }

  // === Attendance ===
  async getAttendanceLog(id: string): Promise<AttendanceLog | undefined> {
    const [log] = await db.select().from(attendanceLogs).where(eq(attendanceLogs.id, id));
    return log || undefined;
  }

  async getAttendanceLogs(startDate?: string, endDate?: string): Promise<AttendanceLog[]> {
    if (startDate && endDate) {
      return db.select().from(attendanceLogs).where(
        and(gte(attendanceLogs.checkInDate, startDate), lte(attendanceLogs.checkInDate, endDate))
      );
    }
    return db.select().from(attendanceLogs);
  }

  async getAttendanceLogsBySite(siteId: string, startDate?: string, endDate?: string): Promise<AttendanceLog[]> {
    if (startDate && endDate) {
      return db.select().from(attendanceLogs).where(
        and(
          eq(attendanceLogs.siteId, siteId),
          gte(attendanceLogs.checkInDate, startDate),
          lte(attendanceLogs.checkInDate, endDate)
        )
      );
    }
    return db.select().from(attendanceLogs).where(eq(attendanceLogs.siteId, siteId));
  }

  async getAttendanceLogsByUser(userId: string, startDate?: string, endDate?: string): Promise<AttendanceLog[]> {
    if (startDate && endDate) {
      return db.select().from(attendanceLogs).where(
        and(
          eq(attendanceLogs.userId, userId),
          gte(attendanceLogs.checkInDate, startDate),
          lte(attendanceLogs.checkInDate, endDate)
        )
      );
    }
    return db.select().from(attendanceLogs).where(eq(attendanceLogs.userId, userId));
  }

  async getTodayAttendanceLog(userId: string, date: string): Promise<AttendanceLog | undefined> {
    const [log] = await db.select().from(attendanceLogs).where(
      and(eq(attendanceLogs.userId, userId), eq(attendanceLogs.checkInDate, date))
    );
    return log || undefined;
  }

  async getAttendanceLogByUserAndDate(userId: string, date: string): Promise<AttendanceLog | undefined> {
    const [log] = await db.select().from(attendanceLogs).where(
      and(eq(attendanceLogs.userId, userId), eq(attendanceLogs.checkInDate, date))
    );
    return log || undefined;
  }

  async getLatestIncompleteAttendanceLog(userId: string): Promise<AttendanceLog | undefined> {
    const [log] = await db.select().from(attendanceLogs).where(
      and(
        eq(attendanceLogs.userId, userId),
        sql`${attendanceLogs.checkOutTime} IS NULL`,
        eq(attendanceLogs.source, "qr") // Only QR check-ins need QR check-outs typically, but fine without it too. Let's just use checkOutTime IS NULL
      )
    ).orderBy(sql`${attendanceLogs.checkInTime} DESC`).limit(1);
    return log || undefined;
  }

  async createAttendanceLog(log: InsertAttendanceLog): Promise<AttendanceLog> {
    const [created] = await db.insert(attendanceLogs).values(log).returning();
    return created;
  }

  async updateAttendanceLog(id: string, data: Partial<AttendanceLog>): Promise<AttendanceLog | undefined> {
    const [updated] = await db.update(attendanceLogs).set(data).where(eq(attendanceLogs.id, id)).returning();
    return updated || undefined;
  }

  async deleteAttendanceLog(id: string): Promise<void> {
    await db.delete(attendanceLogs).where(eq(attendanceLogs.id, id));
  }

  async deleteAttendanceLogByUserAndDate(userId: string, date: string): Promise<void> {
    await db.delete(attendanceLogs).where(
      and(eq(attendanceLogs.userId, userId), eq(attendanceLogs.checkInDate, date))
    );
  }

  async deleteAttendanceLogsByVacationId(vacationId: string): Promise<void> {
    await db.delete(attendanceLogs).where(eq(attendanceLogs.vacationRequestId, vacationId));
  }

  // === Vacation ===
  async getVacationRequests(): Promise<VacationRequest[]> {
    return db.select().from(vacationRequests);
  }

  async getVacationRequestsByUser(userId: string): Promise<VacationRequest[]> {
    return db.select().from(vacationRequests).where(eq(vacationRequests.userId, userId));
  }

  async getVacationRequestsBySite(siteId: string): Promise<VacationRequest[]> {
    // Get all users in this site, then get their vacation requests
    const siteUsers = await this.getUsersBySite(siteId);
    const userIds = siteUsers.map(u => u.id);
    if (userIds.length === 0) return [];

    const allRequests = await db.select().from(vacationRequests);
    return allRequests.filter(r => userIds.includes(r.userId));
  }

  async createVacationRequest(request: InsertVacationRequest): Promise<VacationRequest> {
    const [created] = await db.insert(vacationRequests).values(request).returning();
    return created;
  }

  async updateVacationRequest(id: string, data: Partial<VacationRequest>): Promise<VacationRequest | undefined> {
    const [updated] = await db.update(vacationRequests).set(data).where(eq(vacationRequests.id, id)).returning();
    return updated || undefined;
  }

  async deleteVacationRequest(id: string): Promise<void> {
    await db.delete(vacationRequests).where(eq(vacationRequests.id, id));
  }
  async getVacationRequest(id: string): Promise<VacationRequest | undefined> {
    const [request] = await db.select().from(vacationRequests).where(eq(vacationRequests.id, id));
    return request || undefined;
  }
}

export const storage = new DatabaseStorage();
