import express from "express";
import {
  addBlog,
  getBlog,
  getAllBlogs,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
} from "./blog.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";
import upload from "../middlewares/multer.ts";

const router = express.Router();

// Public routes
router.get("/", getAllBlogs);
router.get("/fetch/:slug", getBlogBySlug); // Get by slug (place before /:id)
router.get("/:id", getBlog); // Get by ID

// Protected routes
router.post("/", verifyJwt, upload.single("picture"), addBlog); // Changed from "cover" to "picture"
router.patch("/:id", verifyJwt, updateBlog);
router.delete("/:id", verifyJwt, deleteBlog);

export default router;