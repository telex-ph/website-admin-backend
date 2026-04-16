import express from "express";
import {
  addBlog,
  getBlog,
  getAllBlogs,
  getBlogBySlug,
  updateBlog,
  archiveBlog,
  restoreBlog,
  likeBlog,
  unlikeBlog,
  checkLikeStatus,
  aiPublishBlog,
} from "./blog.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";
import { verifyApiKey } from "../middlewares/api-key.middleware.ts";
import upload from "../middlewares/multer.ts";
import mongoose from "mongoose";

const router = express.Router();

// ============================================
// 🏓 HEALTH CHECK / PING (no auth needed)
// ============================================
// This endpoint is pinged by UptimeRobot every 5 minutes to:
//   1. Keep the Render server awake (prevent cold start)
//   2. Keep the MongoDB connection warm (prevent 30s timeout on first query)
router.get("/ping", async (req, res) => {
  try {
    // 🔥 Ping MongoDB to keep connection alive
    await mongoose.connection.db?.command({ ping: 1 });
    console.log("🏓 [PING] MongoDB connection warmed up");
  } catch (err) {
    console.warn("⚠️ [PING] MongoDB ping failed (non-critical):", err);
  }

  res.status(200).json({
    status: "ok",
    message: "TelexPH Blog API connected",
    mongoState: mongoose.connection.readyState, // 1 = connected
    endpoints: {
      getAll: "GET /api/blogs",
      getBySlug: "GET /api/blogs/fetch/:slug",
      create: "POST /api/blogs",
      aiPublish: "POST /api/blogs/ai-publish",
      update: "PATCH /api/blogs/:id",
    },
  });
});

router.post("/ping", (req, res) => {
  res.status(200).json({ status: "ok", message: "TelexPH Blog API connected" });
});

// ============================================
// 🤖 AI PLATFORM ROUTE (JSON - no file upload)
// ============================================
router.post("/ai-publish", verifyApiKey, aiPublishBlog);

// ============================================
// 🌐 PUBLIC ROUTES
// ============================================
router.get("/", getAllBlogs);
router.get("/fetch/:slug", getBlogBySlug); // Get by slug (place before /:id)
router.get("/:id", getBlog);              // Get by ID

// ============================================
// 👍 LIKE ROUTES (public - anyone can like)
// ============================================
router.post("/:id/like", likeBlog);
router.delete("/:id/like", unlikeBlog);
router.get("/:id/like-status", checkLikeStatus);

// ============================================
// 🔒 PROTECTED ROUTES
// ============================================
router.post("/", verifyApiKey, upload.single("picture"), addBlog);         // Admin panel
router.patch("/:id", verifyApiKey, upload.single("picture"), updateBlog);  // Admin panel
router.patch("/:id/archive", verifyJwt, archiveBlog);                      // Archive
router.patch("/:id/restore", verifyJwt, restoreBlog);                      // Restore

export default router;