import express from "express";
import {
  addService,
  getAllServices,
  getService,
  getServiceByServiceId,
  updateService,
  toggleServiceStatus,
  deleteService,
} from "./service.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";

const router = express.Router();

// ============================================
// 🔓 PUBLIC ROUTES (No Authentication Required)
// ============================================
router.get("/", getAllServices);                         // Get all services
router.get("/fetch/:serviceId", getServiceByServiceId); // Get by serviceId (e.g., 'ai-builder')
router.get("/:id", getService);                         // Get by MongoDB ID

// ============================================
// 🔒 PROTECTED ROUTES (JWT Required)
// ============================================
router.post("/", verifyJwt, addService);                // Create service

// ⚠️ IMPORTANT: specific routes MUST come before generic /:id routes.
// If /:id is first, Express matches "/:id/toggle" as id="someId" and never
// reaches the toggle handler — causing a 400 from the update validator.
router.patch("/:id/toggle", verifyJwt, toggleServiceStatus); // Toggle status  ← FIRST
router.patch("/:id", verifyJwt, updateService);              // Update service ← SECOND

router.delete("/:id", verifyJwt, deleteService);        // Delete service

export default router;