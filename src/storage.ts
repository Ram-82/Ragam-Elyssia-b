import { users, consultations, contactInquiries, type User, type InsertUser, type Consultation, type InsertConsultation, type ContactInquiry, type InsertContactInquiry } from "./schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createConsultation(consultation: InsertConsultation): Promise<Consultation>;
  getConsultation(id: number): Promise<Consultation | undefined>;
  getConsultationByBookingId(bookingId: string): Promise<Consultation | undefined>;
  updateConsultationSchedule(id: number, scheduledDateTime: string): Promise<Consultation>;
  updateConsultationPayment(id: number, paymentIntentId: string, paymentStatus: string): Promise<Consultation>;
  updateConsultationStatus(id: number, status: string): Promise<Consultation>;
  getAllConsultations(): Promise<Consultation[]>;
  
  createContactInquiry(inquiry: InsertContactInquiry): Promise<ContactInquiry>;
  getAllContactInquiries(): Promise<ContactInquiry[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private consultations: Map<number, Consultation>;
  private contactInquiries: Map<number, ContactInquiry>;
  private currentUserId: number;
  private currentConsultationId: number;
  private currentContactId: number;

  constructor() {
    this.users = new Map();
    this.consultations = new Map();
    this.contactInquiries = new Map();
    this.currentUserId = 1;
    this.currentConsultationId = 1;
    this.currentContactId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createConsultation(insertConsultation: InsertConsultation): Promise<Consultation> {
    const id = this.currentConsultationId++;
    const bookingId = `RE2024-${String(id).padStart(4, '0')}`;
    const consultation: Consultation = {
      ...insertConsultation,
      id,
      bookingId,
      status: "pending",
      scheduledDateTime: null,
      paymentStatus: "unpaid",
      paymentIntentId: null,
      createdAt: new Date(),
      details: insertConsultation.details || null,
    };
    this.consultations.set(id, consultation);
    return consultation;
  }

  async getConsultation(id: number): Promise<Consultation | undefined> {
    return this.consultations.get(id);
  }

  async getConsultationByBookingId(bookingId: string): Promise<Consultation | undefined> {
    return Array.from(this.consultations.values()).find(
      (consultation) => consultation.bookingId === bookingId,
    );
  }

  async updateConsultationSchedule(id: number, scheduledDateTime: string): Promise<Consultation> {
    const consultation = this.consultations.get(id);
    if (!consultation) {
      throw new Error("Consultation not found");
    }
    const updated = { ...consultation, scheduledDateTime, status: "scheduled" };
    this.consultations.set(id, updated);
    return updated;
  }

  async updateConsultationPayment(id: number, paymentIntentId: string, paymentStatus: string): Promise<Consultation> {
    const consultation = this.consultations.get(id);
    if (!consultation) {
      throw new Error("Consultation not found");
    }
    const updated = { ...consultation, paymentIntentId, paymentStatus };
    this.consultations.set(id, updated);
    return updated;
  }

  async updateConsultationStatus(id: number, status: string): Promise<Consultation> {
    const consultation = this.consultations.get(id);
    if (!consultation) {
      throw new Error("Consultation not found");
    }
    const updated = { ...consultation, status };
    this.consultations.set(id, updated);
    return updated;
  }

  async getAllConsultations(): Promise<Consultation[]> {
    return Array.from(this.consultations.values());
  }

  async createContactInquiry(insertInquiry: InsertContactInquiry): Promise<ContactInquiry> {
    const id = this.currentContactId++;
    const inquiry: ContactInquiry = {
      ...insertInquiry,
      id,
      status: "new",
      createdAt: new Date(),
    };
    this.contactInquiries.set(id, inquiry);
    return inquiry;
  }

  async getAllContactInquiries(): Promise<ContactInquiry[]> {
    return Array.from(this.contactInquiries.values());
  }
}

import { db } from "./db";
import { eq } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createConsultation(insertConsultation: InsertConsultation): Promise<Consultation> {
    const [consultation] = await db
      .insert(consultations)
      .values(insertConsultation)
      .returning();
    return consultation;
  }

  async getConsultation(id: number): Promise<Consultation | undefined> {
    const [consultation] = await db.select().from(consultations).where(eq(consultations.id, id));
    return consultation || undefined;
  }

  async getConsultationByBookingId(bookingId: string): Promise<Consultation | undefined> {
    const [consultation] = await db.select().from(consultations).where(eq(consultations.bookingId, bookingId));
    return consultation || undefined;
  }

  async updateConsultationSchedule(id: number, scheduledDateTime: string): Promise<Consultation> {
    const [consultation] = await db
      .update(consultations)
      .set({ scheduledDateTime })
      .where(eq(consultations.id, id))
      .returning();
    return consultation;
  }

  async updateConsultationPayment(id: number, paymentIntentId: string, paymentStatus: string): Promise<Consultation> {
    const [consultation] = await db
      .update(consultations)
      .set({ paymentIntentId, paymentStatus })
      .where(eq(consultations.id, id))
      .returning();
    return consultation;
  }

  async updateConsultationStatus(id: number, status: string): Promise<Consultation> {
    const [consultation] = await db
      .update(consultations)
      .set({ status })
      .where(eq(consultations.id, id))
      .returning();
    return consultation;
  }

  async getAllConsultations(): Promise<Consultation[]> {
    return await db.select().from(consultations);
  }

  async createContactInquiry(insertInquiry: InsertContactInquiry): Promise<ContactInquiry> {
    const [inquiry] = await db
      .insert(contactInquiries)
      .values(insertInquiry)
      .returning();
    return inquiry;
  }

  async getAllContactInquiries(): Promise<ContactInquiry[]> {
    return await db.select().from(contactInquiries);
  }
}

export const storage = new DatabaseStorage();
