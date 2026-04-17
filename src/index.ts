import "dotenv/config";

import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import dns from "node:dns";

// ============================================
// 🌐 DNS FIX FOR WINDOWS (ECONNREFUSED)
// ============================================
// This forces Node to use Google and Cloudflare DNS to resolve MongoDB Atlas SRV records
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// ============================================
// 📦 ROUTER IMPORTS
// ============================================
import authRouter from "./auth/auth.router.js";
import blogRouter from "./blogs/blog.router.js";
import userRouter from "./users/user.router.js";
import caseStudyRouter from "./casestudy/casestudy.router.js";
import dashboardRouter from "./dashboard/dashboard.router.js";
import activityLogRouter from "./activity-logs/activity-log.router.js";
import serviceRouter from "./services/service.router.js";
import pageViewRouter from "./page-views/page-view.router.js";
import clientRouter from "./client/client.router.js";
import appointmentRouter from "./appointments/appointment.router.js";
import applicantRouter from "./applicants/applicant.routes.js";
import vaUsersRouter from "./va-users/va-users.routes.js";
import vaAuthRouter from "./va-users/va-auth.routes.js";
import { trackSitePageView } from "./site-page-views/site-page-view.controller.js";
import { ingestGhlPageView } from "./ghl-page-views/ghl-page-view.controller.js";
import ghlFunnelClientRouter from "./ghl-page-views/ghl-page-view.routes.js";

// ============================================
// 🌱 SEED IMPORTS
// ============================================
import { seedServices } from "./services/seed-services.js";
import { seedPageViews } from "./page-views/seed-page-views.js";

// ============================================
// 🔐 MIDDLEWARE IMPORTS
// ============================================
import { verifyJwt } from "./middlewares/verify-jwt.middleware.js";

const app = express();
const port = process.env.PORT || 5000;

// ============================================
// 🔧 CORE MIDDLEWARE
// ============================================
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
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

app.use("/appointments", appointmentRouter);
app.use("/api/appointments", appointmentRouter);

app.use("/applicants", applicantRouter);
app.use("/api/applicants", applicantRouter);

app.use("/va-users/activate", vaUsersRouter);
app.use("/api/va-users/activate", vaUsersRouter);

app.use("/auth/va", vaAuthRouter);
app.use("/api/auth/va", vaAuthRouter);

app.post("/page-views/track", trackSitePageView);
app.post("/api/page-views/track", trackSitePageView);

// GHL Workflow webhook → funnel page views (secret header; no JWT)
app.post("/ghl/pageview", ingestGhlPageView);
app.post("/api/ghl/pageview", ingestGhlPageView);

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

// Page Views: GET routes are public, POST is protected
app.use("/api/page-views", pageViewRouter);
app.use("/page-views", pageViewRouter);

app.use("/clients", verifyJwt, clientRouter);
app.use("/api/clients", verifyJwt, clientRouter);

app.use("/client/ghl-funnel-analytics", ghlFunnelClientRouter);
app.use("/api/client/ghl-funnel-analytics", ghlFunnelClientRouter);

// Admin funnel analytics routes
app.use("/page-views", verifyJwt, ghlFunnelClientRouter);
app.use("/api/page-views", verifyJwt, ghlFunnelClientRouter);

// ============================================
// ℹ️ HEALTH CHECK ENDPOINT
// ============================================
app.get("/", (req, res) => {
  res.json({
    message: "API is running",
    version: "1.0.0",
    status: "healthy",
  });
});

// ============================================
// 📊 MONGODB CONNECTION → START SERVER
// ============================================
const mongoUri: string = process.env.MONGO_URI || "";

if (!mongoUri) {
  console.error(
    "❌ MONGO_URI environment variable is not set. Server will not start."
  );
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log("✅ Connected to MongoDB");
    await seedServices();

    // 🌱 Seed sample page views if the collection is empty
    await seedPageViews();

    // 🚀 Only start listening AFTER the DB is confirmed ready
    app.listen(port, () => {
      console.log(`🚀 Backend is running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    // process.exit(1); // Optional: keep it running so it can retry on file save
  });