import express from "express";
import {
  addCaseStudy,
  getCaseStudy,
  getAllCaseStudies,
  fetchCaseStudyBySlug,
  getCaseStudyForEdit,
  updateCaseStudy,
  deleteCaseStudy,
  likeCaseStudy,
  unlikeCaseStudy,
  checkCaseStudyLikeStatus,
} from "./casestudy.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";
import upload from "../middlewares/multer.ts";

const router = express.Router();

// ============================================
// 📖 PUBLIC ROUTES (NO AUTHENTICATION NEEDED)
// ============================================
// IMPORTANT: Public routes MUST come FIRST before any protected routes
router.get("/", getAllCaseStudies);                    // Get all case studies (with filters)
router.get("/fetch/:slug", fetchCaseStudyBySlug);      // Get case study by slug
router.get("/:id", getCaseStudy);                      // Get single case study by ID

// ============================================
// ❤️ LIKE/UNLIKE ROUTES (PUBLIC - ANYONE CAN LIKE)
// ============================================
router.post("/:id/like", likeCaseStudy);               // Like a case study
router.delete("/:id/like", unlikeCaseStudy);           // Unlike a case study
router.get("/:id/like-status", checkCaseStudyLikeStatus); // Check if user has liked

// ============================================
// 🔒 PROTECTED ROUTES (AUTHENTICATION REQUIRED)
// ============================================
// These routes require valid JWT token
router.get("/edit/:id", verifyJwt, getCaseStudyForEdit);                    // Get case study for editing
router.post("/", verifyJwt, upload.single("cover"), addCaseStudy);          // Create new case study
router.patch("/:id", verifyJwt, upload.single("cover"), updateCaseStudy);   // Update case study
router.delete("/:id", verifyJwt, deleteCaseStudy);                          // Delete case study

export default router;