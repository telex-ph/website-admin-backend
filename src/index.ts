import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";

// ============================================
// 📦 ROUTER IMPORTS
// ============================================
import authRouter from "./auth/auth.router.ts";
import blogRouter from "./blogs/blog.router.ts";
import userRouter from "./users/user.router.ts";
import caseStudyRouter from "./casestudy/casestudy.router.ts";
import dashboardRouter from "./dashboard/dashboard.router.ts";
import activityLogRouter from "./activity-logs/activity-log.router.ts";
import serviceRouter from "./services/service.router.ts";
import clientRouter from "./client/client.router.ts";
import appointmentRouter from "./appointments/appointment.router.ts";

// ============================================
// 🌱 SEED IMPORTS
// ============================================
import { seedServices } from "./services/seed-services.ts";

// ============================================
// 🔐 MIDDLEWARE IMPORTS
// ============================================
import { verifyJwt } from "./middlewares/verify-jwt.middleware.ts";

const app = express();
const port = 3000;

// ============================================
// 🔧 CORE MIDDLEWARE
// ============================================
app.use(
  cors({
    origin: "http://localhost:3001",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ============================================
// 🔓 PUBLIC ROUTES (NO AUTHENTICATION)
// ============================================
app.use("/auth", authRouter);
app.use("/api/auth", authRouter);

app.use("/api/casestudies", caseStudyRouter);
app.use("/casestudies", caseStudyRouter);

app.use("/api/services", serviceRouter);
app.use("/services", serviceRouter);

// 📅 GHL Appointments — public (fetch slots + book)
// Calendars list, free slots, and booking are public so website visitors can book
app.use("/appointments", appointmentRouter);
app.use("/api/appointments", appointmentRouter);

// ============================================
// 🔒 PROTECTED ROUTES (JWT REQUIRED)
// ============================================
app.use("/users", verifyJwt, userRouter);
app.use("/api/users", verifyJwt, userRouter);

app.use("/blogs", blogRouter);
app.use("/api/blogs", blogRouter);

app.use("/dashboard", verifyJwt, dashboardRouter);
app.use("/api/dashboard", verifyJwt, dashboardRouter);

app.use("/activity-logs", verifyJwt, activityLogRouter);
app.use("/api/activity-logs", verifyJwt, activityLogRouter);

app.use("/clients", verifyJwt, clientRouter);
app.use("/api/clients", verifyJwt, clientRouter);

// ============================================
// ℹ️ HEALTH CHECK ENDPOINT
// ============================================
app.get("/", (req, res) => {
  res.json({
    message: "API is running",
    version: "1.0.0",
    status: "healthy",
    endpoints: {
      public: {
        auth: ["/auth", "/api/auth"],
        casestudies_view: "/api/casestudies (GET)",
        services_view: "/api/services (GET)",
        appointments: {
          calendars: "/api/appointments/calendars (GET)",
          free_slots: "/api/appointments/slots?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&timezone=Asia/Manila (GET)",
          book: "/api/appointments (POST)",
        },
      },
      protected: {
        users: ["/users", "/api/users"],
        blogs: ["/blogs", "/api/blogs"],
        casestudies_manage: "/api/casestudies (POST/PATCH/DELETE)",
        services_manage: "/api/services (POST/PATCH/DELETE)",
        dashboard: ["/dashboard", "/api/dashboard"],
        activity_logs: ["/activity-logs", "/api/activity-logs"],
        clients: ["/clients", "/api/clients"],
        appointments_manage: "/api/appointments/:appointmentId (GET/PUT/DELETE)",
      },
    },
  });
});

// ============================================
// 📊 MONGODB CONNECTION → START SERVER
// ============================================
const mongoUri: string = process.env.MONGO_URI || "";

if (!mongoUri) {
  console.error("❌ MONGO_URI environment variable is not set. Server will not start.");
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log("✅ Connected to MongoDB");
    await seedServices();
    app.listen(port, () => {
      console.log(`🚀 Backend is running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });