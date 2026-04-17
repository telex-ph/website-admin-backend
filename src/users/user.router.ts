import express, { type Request, type Response, type NextFunction } from "express";
import {
  addUser,
  getAllUsers,
  getArchivedUsers,
  getCurrentUser,
  getUser,
  updateUser,
  changePassword,
  archiveUser,
  restoreUser,
  updateTheme
} from "./user.controller.js";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.js";
const router = express.Router();

// Middleware: Main Administrators only (role === 1)
const requireMainAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user || user.role !== 1) {
    return res.status(403).json({
      error: "Forbidden",
      message: "Only Main Administrators can access this resource.",
    });
  }
  next();
};

// Get current logged-in user (must be before /:id route to avoid conflicts)
router.get("/me", verifyJwt, getCurrentUser);

// Change password endpoint
router.post("/change-password", verifyJwt, changePassword);
router.patch("/theme", verifyJwt, updateTheme);

// Archived users — Main Administrators only
router.get("/archived", verifyJwt, requireMainAdmin, getArchivedUsers);

// Other user routes
router.post("/", verifyJwt, addUser);
router.get("/", verifyJwt, getAllUsers);
router.get("/:id", verifyJwt, getUser);
router.patch("/:id", verifyJwt, updateUser);
router.patch("/:id/archive", verifyJwt, requireMainAdmin, archiveUser);
router.patch("/:id/restore", verifyJwt, requireMainAdmin, restoreUser);

export default router;
