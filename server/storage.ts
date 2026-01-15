import {
  users,
  sites,
  attendanceLogs,
  vacationRequests,
  type User,
  type InsertUser,
  type Site,
  type InsertSite,
  type AttendanceLog,
  type InsertAttendanceLog,
  type VacationRequest,
  type InsertVacationRequest,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  
  getSite(id: string): Promise<Site | undefined>;
  getSites(): Promise<Site[]>;
  createSite(site: InsertSite): Promise<Site>;
  updateSite(id: string, data: Partial<InsertSite>): Promise<Site | undefined>;
  deleteSite(id: string): Promise<void>;
  
  getAttendanceLog(id: string): Promise<AttendanceLog | undefined>;
  getAttendanceLogs(startDate?: string, endDate?: string): Promise<AttendanceLog[]>;
  getAttendanceLogsByUser(userId: string, startDate?: string, endDate?: string): Promise<AttendanceLog[]>;
  getTodayAttendanceLog(userId: string, date: string): Promise<AttendanceLog | undefined>;
  createAttendanceLog(log: InsertAttendanceLog): Promise<AttendanceLog>;
  
  getVacationRequests(): Promise<VacationRequest[]>;
  getVacationRequestsByUser(userId: string): Promise<VacationRequest[]>;
  createVacationRequest(request: InsertVacationRequest): Promise<VacationRequest>;
  updateVacationRequest(id: string, data: Partial<VacationRequest>): Promise<VacationRequest | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getSite(id: string): Promise<Site | undefined> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id));
    return site || undefined;
  }

  async getSites(): Promise<Site[]> {
    return db.select().from(sites);
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

  async getAttendanceLog(id: string): Promise<AttendanceLog | undefined> {
    const [log] = await db.select().from(attendanceLogs).where(eq(attendanceLogs.id, id));
    return log || undefined;
  }

  async getAttendanceLogs(startDate?: string, endDate?: string): Promise<AttendanceLog[]> {
    if (startDate && endDate) {
      return db
        .select()
        .from(attendanceLogs)
        .where(
          and(
            gte(attendanceLogs.checkInDate, startDate),
            lte(attendanceLogs.checkInDate, endDate)
          )
        );
    }
    return db.select().from(attendanceLogs);
  }

  async getAttendanceLogsByUser(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<AttendanceLog[]> {
    if (startDate && endDate) {
      return db
        .select()
        .from(attendanceLogs)
        .where(
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
    const [log] = await db
      .select()
      .from(attendanceLogs)
      .where(
        and(eq(attendanceLogs.userId, userId), eq(attendanceLogs.checkInDate, date))
      );
    return log || undefined;
  }

  async createAttendanceLog(log: InsertAttendanceLog): Promise<AttendanceLog> {
    const [created] = await db.insert(attendanceLogs).values(log).returning();
    return created;
  }

  async getVacationRequests(): Promise<VacationRequest[]> {
    return db.select().from(vacationRequests);
  }

  async getVacationRequestsByUser(userId: string): Promise<VacationRequest[]> {
    return db.select().from(vacationRequests).where(eq(vacationRequests.userId, userId));
  }

  async createVacationRequest(request: InsertVacationRequest): Promise<VacationRequest> {
    const [created] = await db.insert(vacationRequests).values(request).returning();
    return created;
  }

  async updateVacationRequest(
    id: string,
    data: Partial<VacationRequest>
  ): Promise<VacationRequest | undefined> {
    const [updated] = await db
      .update(vacationRequests)
      .set(data)
      .where(eq(vacationRequests.id, id))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
