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
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// CORS Configuration
app.use(
  cors({
    origin: "http://localhost:3001", // Frontend URL
    credentials: true, // Important for cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// API Endpoints
app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/blogs", blogRouter);
app.use("/casestudies", caseStudyRouter);
app.use("/dashboard", dashboardRouter); // NEW: Dashboard analytics endpoints

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "API is running",
    version: "1.0.0",
    endpoints: {
      auth: "/auth",
      users: "/users",
      blogs: "/blogs",
      caseStudies: "/casestudies",
      dashboard: "/dashboard",
    },
  });
});

app.listen(port, () => {
  console.log(`Backend is running on http://localhost:${port}`);
  console.log(`Dashboard analytics available at http://localhost:${port}/dashboard`);
});