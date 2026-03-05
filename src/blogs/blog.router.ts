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

const router = express.Router();

// ============================================
// 🏓 HEALTH CHECK / PING (no auth needed)
// ============================================
router.get("/ping", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "TelexPH Blog API connected",
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