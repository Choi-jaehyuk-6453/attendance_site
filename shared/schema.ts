import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, date, boolean, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["admin", "guard"]);
export const companyEnum = pgEnum("company", ["mirae_abm", "dawon_pmc"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("guard"),
  company: companyEnum("company").notNull().default("mirae_abm"),
  phone: text("phone"),
  siteId: varchar("site_id"),
  hireDate: date("hire_date"),
  isActive: boolean("is_active").notNull().default(true),
});

export const usersRelations = relations(users, ({ many }) => ({
  attendanceLogs: many(attendanceLogs),
  vacationRequests: many(vacationRequests),
}));

export const sites = pgTable("sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  company: companyEnum("company").notNull().default("mirae_abm"),
  contractStartDate: date("contract_start_date"),
  contractEndDate: date("contract_end_date"),
  qrCode: text("qr_code"),
  isActive: boolean("is_active").notNull().default(true),
});

export const sitesRelations = relations(sites, ({ many }) => ({
  attendanceLogs: many(attendanceLogs),
}));

export const attendanceLogs = pgTable("attendance_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  checkInTime: timestamp("check_in_time").notNull().defaultNow(),
  checkInDate: date("check_in_date").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
});

export const attendanceLogsRelations = relations(attendanceLogs, ({ one }) => ({
  user: one(users, {
    fields: [attendanceLogs.userId],
    references: [users.id],
  }),
  site: one(sites, {
    fields: [attendanceLogs.siteId],
    references: [sites.id],
  }),
}));

export const vacationStatusEnum = pgEnum("vacation_status", ["pending", "approved", "rejected"]);

export const vacationRequests = pgTable("vacation_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: text("reason"),
  status: vacationStatusEnum("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  respondedBy: varchar("responded_by").references(() => users.id),
});

export const vacationRequestsRelations = relations(vacationRequests, ({ one }) => ({
  user: one(users, {
    fields: [vacationRequests.userId],
    references: [users.id],
  }),
  responder: one(users, {
    fields: [vacationRequests.respondedBy],
    references: [users.id],
  }),
}));

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  department: text("department").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: companyEnum("company").notNull().default("mirae_abm"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertSiteSchema = createInsertSchema(sites).omit({
  id: true,
});

export const insertAttendanceLogSchema = createInsertSchema(attendanceLogs).omit({
  id: true,
  checkInTime: true,
});

export const insertVacationRequestSchema = createInsertSchema(vacationRequests).omit({
  id: true,
  requestedAt: true,
  respondedAt: true,
  respondedBy: true,
  status: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sites.$inferSelect;

export type InsertAttendanceLog = z.infer<typeof insertAttendanceLogSchema>;
export type AttendanceLog = typeof attendanceLogs.$inferSelect;

export type InsertVacationRequest = z.infer<typeof insertVacationRequestSchema>;
export type VacationRequest = typeof vacationRequests.$inferSelect;
