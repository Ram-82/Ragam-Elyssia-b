import express, { Request, Response, NextFunction } from "express";
import { db } from "./db.js";
import { consultations, contactInquiries, insertConsultationSchema, insertContactInquirySchema } from "./schema.js";
import { eq } from "drizzle-orm";

export function registerRoutes(app: express.Application) {
  // API Routes
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  // Submit consultation
  app.post("/api/consultation", async (req: Request, res: Response) => {
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
  app.post("/api/contact", async (req: Request, res: Response) => {
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
  app.get("/api/admin/consultations", async (req: Request, res: Response) => {
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
  app.get("/api/admin/contacts", async (req: Request, res: Response) => {
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
  app.patch("/api/admin/consultations/:id", async (req: Request, res: Response) => {
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
        return res.status(404).json({
          success: false,
          message: "Consultation not found"
        });
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
  app.patch("/api/admin/contacts/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const [updated] = await db.update(contactInquiries)
        .set({ status: status || "new" })
        .where(eq(contactInquiries.id, parseInt(id)))
        .returning();

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: "Contact inquiry not found"
        });
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
  app.get("/api/db-test", async (req: Request, res: Response) => {
    try {
      // Try a simple query (e.g., select 1)
      const result = await db.execute("SELECT 1 as result");
      res.json({ success: true, message: "Database connection successful!", result });
    } catch (error) {
      console.error("Database connection test error:", error);
      res.status(500).json({ success: false, message: "Database connection failed", error: error instanceof Error ? error.message : error });
    }
  });
}