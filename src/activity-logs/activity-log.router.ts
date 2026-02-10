import express from "express";
import {
  getAllActivityLogs,
  getActivityLog,
  getActivityLogsByAdmin,
  getActivityStats,
  deleteOldLogs,
  getUnreadCount,
  markAsRead,
} from "./activity-log.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";

const router = express.Router();

// All routes are protected - only authenticated admins can view logs
router.get("/", verifyJwt, getAllActivityLogs);
router.get("/stats", verifyJwt, getActivityStats);
router.get("/unread-count", verifyJwt, getUnreadCount);
router.post("/mark-as-read", verifyJwt, markAsRead);
router.get("/admin/:email", verifyJwt, getActivityLogsByAdmin);
router.get("/:id", verifyJwt, getActivityLog);
router.delete("/cleanup", verifyJwt, deleteOldLogs);

export default router;