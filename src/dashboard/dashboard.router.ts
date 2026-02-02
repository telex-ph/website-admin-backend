import express from "express";
import {
  getDashboardStats,
  getResourceAnalytics,
  getTopResources,
  getAllAnalytics,
  getComparison,
  getCaseStudyStats, // <--- IMPORT THIS NEW FUNCTION
} from "./dashboard.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";

const router = express.Router();

// All dashboard routes are protected (require authentication)
router.use(verifyJwt);

// Get overall dashboard statistics
router.get("/stats", getDashboardStats);

// NEW: Get aggregated stats specifically for Case Studies
// Ilagay ito BAGO ang /stats/:resourceType o iba pang dynamic routes para hindi matakpan
router.get("/stats/casestudies-summary", getCaseStudyStats); 

// Get comparison between blogs and case studies
router.get("/comparison", getComparison);

// Get all analytics with pagination
router.get("/analytics", getAllAnalytics);

// Get top performing resources (blogs or case studies)
router.get("/top/:resourceType", getTopResources);

// Get analytics for a specific resource
router.get("/analytics/:resourceType/:resourceId", getResourceAnalytics);

export default router;