import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const consultations = pgTable("consultations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  eventType: text("event_type").notNull(),
  eventDate: text("event_date").notNull(),
  location: text("location").notNull(),
  budget: text("budget").notNull(),
  details: text("details"),
  status: text("status").notNull().default("pending"), // pending, scheduled, confirmed, completed
  scheduledDateTime: text("scheduled_date_time"),
  paymentStatus: text("payment_status").default("unpaid"), // unpaid, paid, refunded
  paymentIntentId: text("payment_intent_id"),
  bookingId: text("booking_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contactInquiries = pgTable("contact_inquiries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"), // new, replied
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConsultationSchema = createInsertSchema(consultations).omit({
  id: true,
  status: true,
  scheduledDateTime: true,
  paymentStatus: true,
  paymentIntentId: true,
  bookingId: true,
  createdAt: true,
});

export const insertContactInquirySchema = createInsertSchema(contactInquiries).omit({
  id: true,
  status: true,
  createdAt: true,
});

export type InsertConsultation = z.infer<typeof insertConsultationSchema>;
export type Consultation = typeof consultations.$inferSelect;
export type InsertContactInquiry = z.infer<typeof insertContactInquirySchema>;
export type ContactInquiry = typeof contactInquiries.$inferSelect;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
