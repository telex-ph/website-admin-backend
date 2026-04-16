import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import dns from "node:dns"; // Import DNS module

// ============================================
// 🌐 DNS FIX FOR WINDOWS (ECONNREFUSED)
// ============================================
// This forces Node to use Google and Cloudflare DNS to resolve MongoDB Atlas SRV records
dns.setServers(["8.8.8.8", "1.1.1.1"]);

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
import pageViewRouter from "./page-views/page-view.router.ts";
import clientRouter from "./client/client.router.ts";
import appointmentRouter from "./appointments/appointment.router.ts";
import applicantRouter from "./applicants/applicant.routes.ts";
import vaUsersRouter   from "./va-users/va-users.routes.ts";
import vaAuthRouter    from "./va-users/va-auth.routes.ts";
import { trackSitePageView } from "./site-page-views/site-page-view.controller.ts";
import { ingestGhlPageView } from "./ghl-page-views/ghl-page-view.controller.ts";
import ghlFunnelClientRouter from "./ghl-page-views/ghl-page-view.routes.ts";

// ============================================
// 🌱 SEED IMPORTS
// ============================================
import { seedServices } from "./services/seed-services.ts";
import { seedPageViews } from "./page-views/seed-page-views.ts";

// ============================================
// 🔐 MIDDLEWARE IMPORTS
// ============================================
import { verifyJwt } from "./middlewares/verify-jwt.middleware.ts";

const app = express();
const port = process.env.PORT || 5000;

// ============================================
// 🔧 CORE MIDDLEWARE
// ============================================
app.use(
  cors({
    origin: ["http://localhost:3001", "http://127.0.0.1:3001", "http://localhost:3000", "http://127.0.0.1:3000"],
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
  console.error("❌ MONGO_URI environment variable is not set. Server will not start.");
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