import express, { Request, Response, NextFunction } from "express";
import { db } from "./db.js";
import { consultations, contactInquiries, insertConsultationSchema, insertContactInquirySchema, insertUserSchema } from "./schema.js";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { users } from "./schema.js";
import { z } from "zod";
import crypto from "crypto";
import FormData from "form-data";
import Mailgun from "mailgun.js";

export function registerRoutes(app: express.Application) {
  // API Routes
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  // Submit consultation
  app.post("/api/consultation", async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = insertConsultationSchema.parse(req.body);
      
      // Generate booking ID
      const bookingId = `RGM-${Date.now()}`;
      
      const [consultation] = await db.insert(consultations).values({
        ...validatedData,
        bookingId,
        status: "pending",
        paymentStatus: "unpaid"
      }).returning();
        
      res.json({ 
        success: true,
        message: "Consultation request submitted successfully",
        bookingId: consultation.bookingId,
        consultation
      });
    } catch (error) {
      console.error("Consultation submission error:", error);
      res.status(400).json({ 
        success: false,
        message: "Failed to submit consultation request",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Submit contact form
  app.post("/api/contact", async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = insertContactInquirySchema.parse(req.body);
      
      const [contact] = await db.insert(contactInquiries).values({
        ...validatedData,
        status: "new"
      }).returning();

      res.json({
        success: true,
        message: "Contact form submitted successfully",
        contact
      });
    } catch (error) {
      console.error("Contact submission error:", error);
      res.status(400).json({
        success: false,
        message: "Failed to submit contact form",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get all consultations (admin endpoint)
  app.get("/api/admin/consultations", async (req: Request, res: Response): Promise<void> => {
    try {
      const allConsultations = await db.select().from(consultations).orderBy(consultations.createdAt);
      res.json({
        success: true,
        consultations: allConsultations
      });
    } catch (error) {
      console.error("Error fetching consultations:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch consultations"
      });
    }
  });

  // Get all contact inquiries (admin endpoint)
  app.get("/api/admin/contacts", async (req: Request, res: Response): Promise<void> => {
    try {
      const allContacts = await db.select().from(contactInquiries).orderBy(contactInquiries.createdAt);
      res.json({
        success: true,
        contacts: allContacts
      });
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch contact inquiries"
      });
    }
  });

  // Update consultation status
  app.patch("/api/admin/consultations/:id", async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, scheduledDateTime } = req.body;
      
      const [updated] = await db.update(consultations)
        .set({ 
          status: status || "pending",
          scheduledDateTime: scheduledDateTime || null
        })
        .where(eq(consultations.id, parseInt(id)))
        .returning();

      if (!updated) {
        res.status(404).json({
          success: false,
          message: "Consultation not found"
        });
        return;
      }

      res.json({
        success: true,
        message: "Consultation updated successfully",
        consultation: updated
      });
    } catch (error) {
      console.error("Error updating consultation:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update consultation"
      });
    }
  });

  // Update contact status
  app.patch("/api/admin/contacts/:id", async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const [updated] = await db.update(contactInquiries)
        .set({ status: status || "new" })
        .where(eq(contactInquiries.id, parseInt(id)))
        .returning();

      if (!updated) {
        res.status(404).json({
          success: false,
          message: "Contact inquiry not found"
        });
        return;
      }

      res.json({
        success: true,
        message: "Contact inquiry updated successfully",
        contact: updated
      });
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update contact inquiry"
      });
    }
  });

  // Database connection test endpoint
  app.get("/api/db-test", async (req: Request, res: Response): Promise<void> => {
    try {
      // Try a simple query (e.g., select 1)
      const result = await db.execute("SELECT 1 as result");
      res.json({ success: true, message: "Database connection successful!", result });
    } catch (error) {
      console.error("Database connection test error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Database connection failed", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Health check endpoint
  app.get("/api/health", async (req: Request, res: Response): Promise<void> => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Hidden database health check endpoint
  app.get("/api/db-health", async (req: Request, res: Response): Promise<void> => {
    try {
      // Try a simple query (e.g., select 1)
      const result = await db.execute("SELECT 1 as result");
      res.json({ success: true, message: "Database connection successful!", result });
    } catch (error) {
      console.error("Database health check error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Database connection failed", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Signup endpoint
  app.post("/api/signup", async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = insertUserSchema.safeParse({
        fullName: req.body.fullName,
        email: req.body.email,
        passwordHash: "temp" // placeholder, will hash below
      });
      if (!parsed.success) {
        res.status(400).json({ success: false, message: "Invalid input", errors: parsed.error.errors });
        return;
      }
      const { fullName, email } = parsed.data;
      const password = req.body.password;
      if (!password || password.length < 6) {
        res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
        return;
      }
      const existing = await db.select().from(users).where(eq(users.email, email));
      if (existing.length > 0) {
        res.status(400).json({ success: false, message: "Email already registered" });
        return;
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const [user] = await db.insert(users).values({ fullName, email, passwordHash }).returning();
      res.json({ success: true, message: "Signup successful", user: { id: user.id, fullName, email } });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ success: false, message: "Signup failed", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Login endpoint
  app.post("/api/login", async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ success: false, message: "Email and password required" });
        return;
      }
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user) {
        res.status(401).json({ success: false, message: "Invalid credentials" });
        return;
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ success: false, message: "Invalid credentials" });
        return;
      }
      const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || "changeme", { expiresIn: "7d" });
      res.json({ success: true, token, user: { id: user.id, fullName: user.fullName, email: user.email } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ success: false, message: "Login failed" });
    }
  });

  // Password reset request endpoint
  app.post("/api/password-reset-request", async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ success: false, message: "Email required" });
        return;
      }
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user) {
        res.status(200).json({ success: true, message: "If that email exists, a reset link will be sent." });
        return;
      }
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
      await db.update(users).set({ passwordResetToken: token, passwordResetExpires: expires }).where(eq(users.id, user.id));
      // Send email with token using Mailgun
      const mailgun = new Mailgun(FormData);
      const mg = mailgun.client({
        username: "api",
        key: process.env.MAIL_API_KEY || "YOUR_API_KEY",
      });
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
      try {
        await mg.messages.create(`${process.env.MY_DOMAIN}`, {
          from: `Ragam Elyssia <noreply@${process.env.MY_DOMAIN}.com>`,
          to: [email],
          subject: "Password Reset Request",
          html: `
          <div style="background: linear-gradient(135deg, #fdf6e3 0%, #f5e9d7 100%); padding: 40px 0;">
            <div style="max-width: 480px; margin: 0 auto; background: #fff8f1; border-radius: 18px; box-shadow: 0 4px 24px rgba(0,0,0,0.07); padding: 32px 28px; font-family: 'Playfair Display', 'Georgia', serif, 'Segoe UI', sans-serif;">
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="https://www.ragamelyssia.com" target="_blank" rel="noopener noreferrer">
                  <img src="https://iili.io/FljfZ0P.png" alt="Ragam Elyssia" style="height: 150px;" />
                </a>
                <h2 style="color: #7c5e2c; font-weight: 400; font-size: 2rem; margin: 0 0 8px 0; font-family: 'Playfair Display', serif;">Reset Your Password</h2>
                <p style="color: #a68a64; font-size: 1rem; margin: 0;">We received a request to reset your password.</p>
              </div>
              <div style="margin: 32px 0; text-align: center;">
                <a href="${resetLink}" style="display: inline-block; background: #ffe0a3 !important; color: #7c5e2c !important; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 12px; font-size: 1.1rem; box-shadow: 0 2px 8px rgba(124,94,44,0.07); transition: background 0.2s;">
                  Set New Password
                </a>
              </div>
              <p style="color: #7c5e2c; font-size: 1rem; text-align: center; margin: 0 0 16px 0;">
                If you did not request this, you can safely ignore this email.<br>
                This link will expire in 1 hour.
              </p>
              <div style="margin-top: 32px; text-align: center; color: #bfa77a; font-size: 0.95rem;">
                — The Ragam Elyssia Team
              </div>
            </div>
          </div>
          `,
        });
      } catch (mailError) {
        console.error("Mailgun error:", mailError);
        // Don't reveal email errors to the user for security
      }
      res.json({ success: true, message: "If that email exists, a reset link will be sent." });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({ success: false, message: "Password reset request failed" });
    }
  });

  // Password reset endpoint
  app.post("/api/password-reset", async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, token, newPassword } = req.body;
      if (!email || !token || !newPassword) {
        res.status(400).json({ success: false, message: "Missing required fields" });
        return;
      }
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
        res.status(400).json({ success: false, message: "Invalid or expired token" });
        return;
      }
      if (user.passwordResetToken !== token || new Date(user.passwordResetExpires) < new Date()) {
        res.status(400).json({ success: false, message: "Invalid or expired token" });
        return;
      }
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.update(users).set({ passwordHash, passwordResetToken: null, passwordResetExpires: null }).where(eq(users.id, user.id));
      res.json({ success: true, message: "Password reset successful" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ success: false, message: "Password reset failed" });
    }
  });
}