import express from "express";
import {
  addCaseStudy,
  getCaseStudy,
  getAllCaseStudies,
  fetchCaseStudyBySlug,
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

// Protected routes
router.post("/", verifyJwt, upload.single("cover"), addCaseStudy);
router.patch("/:id", verifyJwt, updateCaseStudy);
router.delete("/:id", verifyJwt, deleteCaseStudy);

export default router;