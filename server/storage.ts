import {
  users,
  sites,
  attendanceLogs,
  vacationRequests,
  contacts,
  type User,
  type InsertUser,
  type Site,
  type InsertSite,
  type AttendanceLog,
  type InsertAttendanceLog,
  type VacationRequest,
  type InsertVacationRequest,
  type Contact,
  type InsertContact,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsersByUsername(username: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  
  getSite(id: string): Promise<Site | undefined>;
  getSites(): Promise<Site[]>;
  createSite(site: InsertSite): Promise<Site>;
  updateSite(id: string, data: Partial<InsertSite>): Promise<Site | undefined>;
  deleteSite(id: string): Promise<void>;
  
  getAttendanceLog(id: string): Promise<AttendanceLog | undefined>;
  getAttendanceLogs(startDate?: string, endDate?: string): Promise<AttendanceLog[]>;
  getAttendanceLogsByUser(userId: string, startDate?: string, endDate?: string): Promise<AttendanceLog[]>;
  getTodayAttendanceLog(userId: string, date: string): Promise<AttendanceLog | undefined>;
  getAttendanceLogByUserAndDate(userId: string, date: string): Promise<AttendanceLog | undefined>;
  createAttendanceLog(log: InsertAttendanceLog): Promise<AttendanceLog>;
  updateAttendanceLog(id: string, data: Partial<AttendanceLog>): Promise<AttendanceLog | undefined>;
  deleteAttendanceLog(id: string): Promise<void>;
  deleteAttendanceLogByUserAndDate(userId: string, date: string): Promise<void>;
  deleteAttendanceLogsByVacationId(vacationId: string): Promise<void>;
  
  getVacationRequests(): Promise<VacationRequest[]>;
  getVacationRequestsByUser(userId: string): Promise<VacationRequest[]>;
  createVacationRequest(request: InsertVacationRequest): Promise<VacationRequest>;
  updateVacationRequest(id: string, data: Partial<VacationRequest>): Promise<VacationRequest | undefined>;
  deleteVacationRequest(id: string): Promise<void>;
  
  getContacts(): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, data: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<void>;
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

  async getUsersByUsername(username: string): Promise<User[]> {
    return db.select().from(users).where(
      and(eq(users.username, username), eq(users.isActive, true))
    );
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

  async deleteUser(id: string): Promise<void> {
    // First delete all attendance logs for this user
    await db.delete(attendanceLogs).where(eq(attendanceLogs.userId, id));
    // Then delete all vacation requests for this user
    await db.delete(vacationRequests).where(eq(vacationRequests.userId, id));
    // Finally delete the user
    await db.delete(users).where(eq(users.id, id));
  }

  async getSite(id: string): Promise<Site | undefined> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id));
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

  async getAttendanceLogByUserAndDate(userId: string, date: string): Promise<AttendanceLog | undefined> {
    const [log] = await db
      .select()
      .from(attendanceLogs)
      .where(
        and(eq(attendanceLogs.userId, userId), eq(attendanceLogs.checkInDate, date))
      );
    return log || undefined;
  }

  async deleteAttendanceLog(id: string): Promise<void> {
    await db.delete(attendanceLogs).where(eq(attendanceLogs.id, id));
  }

  async deleteAttendanceLogByUserAndDate(userId: string, date: string): Promise<void> {
    await db.delete(attendanceLogs).where(
      and(eq(attendanceLogs.userId, userId), eq(attendanceLogs.checkInDate, date))
    );
  }

  async updateAttendanceLog(id: string, data: Partial<AttendanceLog>): Promise<AttendanceLog | undefined> {
    const [updated] = await db.update(attendanceLogs).set(data).where(eq(attendanceLogs.id, id)).returning();
    return updated || undefined;
  }

  async deleteAttendanceLogsByVacationId(vacationId: string): Promise<void> {
    await db.delete(attendanceLogs).where(eq(attendanceLogs.vacationRequestId, vacationId));
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

  async deleteVacationRequest(id: string): Promise<void> {
    await db.delete(vacationRequests).where(eq(vacationRequests.id, id));
  }

  async getContacts(): Promise<Contact[]> {
    return db.select().from(contacts).where(eq(contacts.isActive, true));
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact || undefined;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [created] = await db.insert(contacts).values(contact).returning();
    return created;
  }

  async updateContact(id: string, data: Partial<InsertContact>): Promise<Contact | undefined> {
    const [updated] = await db.update(contacts).set(data).where(eq(contacts.id, id)).returning();
    return updated || undefined;
  }

  async deleteContact(id: string): Promise<void> {
    await db.update(contacts).set({ isActive: false }).where(eq(contacts.id, id));
  }
}

export const storage = new DatabaseStorage();
