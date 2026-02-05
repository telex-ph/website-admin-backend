import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import blogRouter from "./blogs/blog.router.ts";
import authRouter from "./auth/auth.router.ts";
import userRouter from "./users/user.router.ts";
import caseStudyRouter from "./casestudy/casestudy.router.ts";
import dashboardRouter from "./dashboard/dashboard.router.ts";

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
// 🔧 CORS CONFIGURATION
// ============================================
app.use(
  cors({
    origin: "http://localhost:3001", // Frontend URL
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ============================================
// 🛠 DEBUG LOGGING (Optional - remove in production)
// ============================================
app.use((req, res, next) => {
  console.log("📨 Request:", {
    method: req.method,
    url: req.url,
    path: req.path,
    hasAuthHeader: !!req.headers.authorization,
    hasCookie: !!req.cookies?.accessToken
  });
  next();
});

// ============================================
// 🔧 BASIC MIDDLEWARE
// ============================================
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// ============================================
// 🔓 PUBLIC ROUTES (NO AUTHENTICATION)
// ============================================
// IMPORTANT: Public routes MUST come FIRST!

// Auth routes (login, register, logout)
app.use("/auth", authRouter);
app.use("/api/auth", authRouter);

// Case Studies - PUBLIC for viewing
app.use("/api/casestudies", caseStudyRouter);
app.use("/casestudies", caseStudyRouter);

// ============================================
// 🔒 PROTECTED ROUTES (AUTHENTICATION REQUIRED)
// ============================================
// These routes require valid JWT token

// Import verifyJwt middleware
import { verifyJwt } from "./middlewares/verify-jwt.middleware.ts";

// Users
app.use("/users", verifyJwt, userRouter);
app.use("/api/users", verifyJwt, userRouter);

// Blogs - PROTECTED routes
app.use("/blogs", verifyJwt, blogRouter);
app.use("/api/blogs", verifyJwt, blogRouter);

// Dashboard
app.use("/dashboard", verifyJwt, dashboardRouter);
app.use("/api/dashboard", verifyJwt, dashboardRouter);

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
      },
      protected: {
        users: ["/users", "/api/users"],
        blogs: ["/blogs", "/api/blogs"],
        casestudies_manage: "/api/casestudies (POST/PATCH/DELETE)",
        dashboard: ["/dashboard", "/api/dashboard"],
      }
    },
  });
});

// ============================================
// 🚀 START SERVER
// ============================================
app.listen(port, () => {
  console.log(`🚀 Backend is running on http://localhost:${port}`);
  console.log(`🌐 Frontend URL: http://localhost:3001`);
  console.log(`✅ CORS enabled for frontend`);
  console.log(`\n📋 Public Routes:`);
  console.log(`   - POST /api/auth/login`);
  console.log(`   - POST /api/auth/register`);
  console.log(`   - GET  /api/casestudies (view all)`);
  console.log(`   - GET  /api/casestudies/:id (view single)`);
  console.log(`   - GET  /api/casestudies/fetch/:slug (view by slug)`);
  console.log(`\n🔒 Protected Routes (require JWT):`);
  console.log(`   - POST   /api/blogs (create blog)`);
  console.log(`   - GET    /api/blogs (get all blogs)`);
  console.log(`   - GET    /api/blogs/:id (get single blog)`);
  console.log(`   - PATCH  /api/blogs/:id (update blog)`);
  console.log(`   - DELETE /api/blogs/:id (delete blog)`);
  console.log(`   - POST   /api/casestudies (create)`);
  console.log(`   - PATCH  /api/casestudies/:id (update)`);
  console.log(`   - DELETE /api/casestudies/:id (delete)`);
  console.log(`   - All /api/users routes`);
  console.log(`   - All /api/dashboard routes`);
});