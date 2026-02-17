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

// ============================================
// 🔐 MIDDLEWARE IMPORTS
// ============================================
// FIX: import must always be at the top of the file — never inside the body
import { verifyJwt } from "./middlewares/verify-jwt.middleware.ts";

const app = express();
const port = 3000;

// ============================================
// 📊 MONGODB CONNECTION
// ============================================
const mongoUri: string = process.env.MONGO_URI || "";
mongoose
  .connect(mongoUri)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ============================================
// 🔧 CORE MIDDLEWARE — MUST BE BEFORE ALL ROUTES
// ============================================
// FIX: cors → json → urlencoded → cookieParser must ALL be registered
// before any route or debug logger. Previously cookieParser was registered
// AFTER the debug logger and routes, so req.cookies was always empty
// when verifyJwt ran → every protected request returned 400/401
// even when the user was properly logged in.

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
app.use(cookieParser()); // ← must be here so req.cookies is populated before any route runs

// ============================================
// 🛠 DEBUG LOGGING (remove in production)
// ============================================
// FIX: logger is now AFTER cookieParser so req.cookies is actually readable
app.use((req, res, next) => {
  console.log("📨 Request:", {
    method: req.method,
    url: req.url,
    path: req.path,
    hasAuthHeader: !!req.headers.authorization,
    hasCookie: !!req.cookies?.accessToken, // now correctly populated
  });
  next();
});

// ============================================
// 🔓 PUBLIC ROUTES (NO AUTHENTICATION)
// ============================================
app.use("/auth", authRouter);
app.use("/api/auth", authRouter);

app.use("/api/casestudies", caseStudyRouter);
app.use("/casestudies", caseStudyRouter);

// Services: GET routes are public, POST/PATCH/DELETE are protected inside service.router.ts
app.use("/api/services", serviceRouter);
app.use("/services", serviceRouter);

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
      },
      protected: {
        users: ["/users", "/api/users"],
        blogs: ["/blogs", "/api/blogs"],
        casestudies_manage: "/api/casestudies (POST/PATCH/DELETE)",
        services_manage: "/api/services (POST/PATCH/DELETE)",
        dashboard: ["/dashboard", "/api/dashboard"],
        activity_logs: ["/activity-logs", "/api/activity-logs"],
      },
    },
  });
});

// ============================================
// 🚀 START SERVER
// ============================================
app.listen(port, () => {
  console.log(`🚀 Backend is running on http://localhost:${port}`);
  console.log(`🌐 Frontend URL: http://localhost:3001`);
  console.log(`✅ CORS + cookieParser ready`);
  console.log(`\n📋 Public Routes:`);
  console.log(`   - POST /api/auth/authenticate`);
  console.log(`   - POST /api/auth/refresh`);
  console.log(`   - POST /api/auth/logout`);
  console.log(`   - GET  /api/casestudies (view all)`);
  console.log(`   - GET  /api/casestudies/:id (view single)`);
  console.log(`   - GET  /api/casestudies/fetch/:slug (view by slug)`);
  console.log(`   - GET  /api/services (view all services)`);
  console.log(`   - GET  /api/services/:id (view single service)`);
  console.log(`   - GET  /api/services/fetch/:serviceId (view by serviceId)`);
  console.log(`\n🔒 Protected Routes (require JWT):`);
  console.log(`   - POST   /api/services (create service)`);
  console.log(`   - PATCH  /api/services/:id/toggle (toggle service status)`);
  console.log(`   - PATCH  /api/services/:id (update service)`);
  console.log(`   - DELETE /api/services/:id (delete service)`);
  console.log(`   - POST   /api/blogs (create blog)`);
  console.log(`   - GET    /api/blogs (get all blogs)`);
  console.log(`   - GET    /api/blogs/:id (get single blog)`);
  console.log(`   - PATCH  /api/blogs/:id (update blog)`);
  console.log(`   - DELETE /api/blogs/:id (delete blog)`);
  console.log(`   - POST   /api/casestudies (create)`);
  console.log(`   - PATCH  /api/casestudies/:id (update)`);
  console.log(`   - DELETE /api/casestudies/:id (delete)`);
  console.log(`   - GET    /api/activity-logs (get all logs)`);
  console.log(`   - GET    /api/activity-logs/stats (get statistics)`);
  console.log(`   - GET    /api/activity-logs/:id (get single log)`);
  console.log(`   - GET    /api/activity-logs/admin/:email (get logs by admin)`);
  console.log(`   - DELETE /api/activity-logs/cleanup (delete old logs)`);
  console.log(`   - All /api/users routes`);
  console.log(`   - All /api/dashboard routes`);
});