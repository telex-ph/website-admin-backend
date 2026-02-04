import express from "express";
import {
  addCaseStudy,
  getCaseStudy,
  getAllCaseStudies,
  fetchCaseStudyBySlug,
  getCaseStudyForEdit,
  updateCaseStudy,
  deleteCaseStudy,
} from "./casestudy.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";
import upload from "../middlewares/multer.ts";

const router = express.Router();

// Public routes
router.get("/", getAllCaseStudies);
router.get("/fetch/:slug", fetchCaseStudyBySlug);
router.get("/:id", getCaseStudy);

// Protected routes - require authentication for create/update/delete
router.get("/edit/:id", verifyJwt, getCaseStudyForEdit); // Protected route for editing
router.post("/", verifyJwt, upload.single("cover"), addCaseStudy); // ← ADDED verifyJwt
router.patch("/:id", verifyJwt, upload.single("cover"), updateCaseStudy); // ← ADDED verifyJwt
router.delete("/:id", verifyJwt, deleteCaseStudy); // ← ADDED verifyJwt (removed upload since delete doesn't need it)

export default router;