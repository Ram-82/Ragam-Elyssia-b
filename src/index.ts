import express, { type Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";
import { registerRoutes } from "./routes.js";
import dotenv from 'dotenv';
dotenv.config();

const app = express();

// CORS configuration for frontend
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://localhost:5173",
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "X-Requested-With",
    "Accept",
    "Origin"
  ],
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
} as CorsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json.bind(res); // Use bind instead of overriding to maintain type safety
  res.json = function (bodyJson: any) {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
});

// Register API routes
registerRoutes(app);

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({ message });
  console.error(err);
});

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
});