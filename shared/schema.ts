import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, date, boolean, pgEnum, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["hq_admin", "site_manager", "worker"]);
export const companyEnum = pgEnum("company", ["mirae_abm", "dawon_pmc"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("worker"),
  phone: text("phone"),
  siteId: varchar("site_id"),
  departmentId: varchar("department_id"),
  jobTitle: text("job_title"),
  hireDate: date("hire_date"),
  isActive: boolean("is_active").notNull().default(true),
  company: companyEnum("company").default("mirae_abm"),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  site: one(sites, {
    fields: [users.siteId],
    references: [sites.id],
  }),
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  attendanceLogs: many(attendanceLogs),
  vacationRequests: many(vacationRequests),
}));

export const sites = pgTable("sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  contractStartDate: date("contract_start_date"),
  contractEndDate: date("contract_end_date"),
  qrCode: text("qr_code"),
  managerEmail: text("manager_email"),
  isActive: boolean("is_active").notNull().default(true),
  company: companyEnum("company").notNull().default("mirae_abm"),
});

export const sitesRelations = relations(sites, ({ many }) => ({
  departments: many(departments),
  attendanceLogs: many(attendanceLogs),
}));

export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  site: one(sites, {
    fields: [departments.siteId],
    references: [sites.id],
  }),
  users: many(users),
}));

export const attendanceTypeEnum = pgEnum("attendance_type", ["normal", "annual", "half_day", "sick", "family_event", "other"]);
export const attendanceSourceEnum = pgEnum("attendance_source", ["qr", "manual", "vacation"]);

export const attendanceLogs = pgTable("attendance_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  siteId: varchar("site_id").notNull().references(() => sites.id),
  checkInTime: timestamp("check_in_time").notNull().defaultNow(),
  checkInDate: date("check_in_date").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  attendanceType: attendanceTypeEnum("attendance_type").notNull().default("normal"),
  source: attendanceSourceEnum("source").notNull().default("qr"),
  vacationRequestId: varchar("vacation_request_id"),
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
export const vacationTypeEnum = pgEnum("vacation_type", ["annual", "half_day", "sick", "family_event", "other"]);

export const vacationRequests = pgTable("vacation_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  vacationType: vacationTypeEnum("vacation_type").notNull().default("annual"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  days: real("days").notNull().default(1),
  reason: text("reason"),
  substituteWork: text("substitute_work").notNull().default("X"),
  status: vacationStatusEnum("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  respondedBy: varchar("responded_by").references(() => users.id),
  rejectionReason: text("rejection_reason"),
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertSiteSchema = createInsertSchema(sites).omit({
  id: true,
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
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

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sites.$inferSelect;

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

export type InsertAttendanceLog = z.infer<typeof insertAttendanceLogSchema>;
export type AttendanceLog = typeof attendanceLogs.$inferSelect;

export type InsertVacationRequest = z.infer<typeof insertVacationRequestSchema>;
export type VacationRequest = typeof vacationRequests.$inferSelect;
