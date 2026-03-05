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
} from "./blog.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";
import { verifyApiKey } from "../middlewares/api-key.middleware.ts";
import upload from "../middlewares/multer.ts";

const router = express.Router();

// Public routes
router.get("/", getAllBlogs);
router.get("/fetch/:slug", getBlogBySlug); // Get by slug (place before /:id)
router.get("/:id", getBlog); // Get by ID

// Like routes (public - anyone can like)
router.post("/:id/like", likeBlog); // Like a blog
router.delete("/:id/like", unlikeBlog); // Unlike a blog
router.get("/:id/like-status", checkLikeStatus); // Check if user has liked

// Protected routes - with image upload support
//router.post("/", verifyJwt, upload.single("picture"), addBlog);
//router.patch("/:id", verifyJwt, upload.single("picture"), updateBlog);
router.post("/", verifyApiKey, upload.single("picture"), addBlog);
router.patch("/:id", verifyApiKey, upload.single("picture"), updateBlog);
router.patch("/:id/archive", verifyJwt, archiveBlog); // Archive (soft delete)
router.patch("/:id/restore", verifyJwt, restoreBlog); // Restore from archive

export default router;