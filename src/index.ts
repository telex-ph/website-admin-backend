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
// Routes WITHOUT /api (for your existing Postman requests)
app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/blogs", blogRouter);
app.use("/casestudies", caseStudyRouter);
app.use("/dashboard", dashboardRouter);

// Routes WITH /api (for frontend analytics)
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/blogs", blogRouter);
app.use("/api/casestudies", caseStudyRouter);
app.use("/api/dashboard", dashboardRouter);

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

app.listen(port, () => {
  console.log(`🚀 Backend is running on http://localhost:${port}`);
  console.log(`📊 Dashboard analytics available at:`);
  console.log(`   - http://localhost:${port}/dashboard (without /api)`);
  console.log(`   - http://localhost:${port}/api/dashboard (with /api)`);
  console.log(`🌐 Frontend URL: http://localhost:3001`);
  console.log(`✅ CORS enabled for frontend`);
  console.log(`✅ Both /api and non-/api routes are available`);
});
