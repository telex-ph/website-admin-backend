import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import blogRouter from "./blogs/blog.router.ts";
import authRouter from "./auth/auth.router.ts";
import userRouter from "./users/user.router.ts";
import caseStudyRouter from "./casestudy/casestudy.router.ts";
import dashboardRouter from "./dashboard/dashboard.router.ts";
// 1. I-import ang middleware
import { verifyJwt } from "./middlewares/verify-jwt.middleware.ts";

const app = express();
const port = 3000;

// MongoDB Connection
const mongoUri: string = process.env.MONGO_URI || "";
mongoose
  .connect(mongoUri)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// CORS Configuration
app.use(
  cors({
    origin: "http://localhost:3001",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// API Endpoints - BOTH with and without /api prefix

// Public Routes (Hindi kailangan ng verifyJwt para makapag-login)
app.use("/auth", authRouter);
app.use("/api/auth", authRouter);

// --- PROTECTED ROUTES ---
// 2. Dito natin idinagdag ang verifyJwt bago ang bawat router
app.use("/users", verifyJwt, userRouter);
app.use("/blogs", verifyJwt, blogRouter);
app.use("/casestudies", verifyJwt, caseStudyRouter);
app.use("/dashboard", verifyJwt, dashboardRouter);

// Routes WITH /api prefix
app.use("/api/users", verifyJwt, userRouter);
app.use("/api/blogs", verifyJwt, blogRouter);
app.use("/api/casestudies", verifyJwt, caseStudyRouter);
app.use("/api/dashboard", verifyJwt, dashboardRouter);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "API is running",
    version: "1.0.0",
    endpoints: {
      "Without /api prefix": {
        auth: "/auth",
        users: "/users",
        blogs: "/blogs",
        caseStudies: "/casestudies",
        dashboard: "/dashboard",
      },
      "With /api prefix": {
        auth: "/api/auth",
        users: "/api/users",
        blogs: "/api/blogs",
        caseStudies: "/api/casestudies",
        dashboard: "/api/dashboard",
      }
    },
  });
});

app.listen(port, () => { //
  console.log(`🚀 Backend is running on http://localhost:${port}`);
  console.log(`📊 Dashboard analytics available at:`);
  console.log(`   - http://localhost:${port}/dashboard (Protected)`);
  console.log(`   - http://localhost:${port}/api/dashboard (Protected)`);
  console.log(`🌐 Frontend URL: http://localhost:3001`);
  console.log(`✅ CORS enabled for frontend`);
  console.log(`✅ Both /api and non-/api routes are available`);
});