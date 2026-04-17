import express, { type Request, type Response, type NextFunction } from "express";
import {
  addClient,
  getAllClients,
  getArchivedClients,
  getClient,
  updateClient,
  changeClientPassword,
  archiveClient,
  restoreClient,
} from "./client.controller.js";
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

// Archived clients — Main Administrators only
router.get("/archived", verifyJwt, requireMainAdmin, getArchivedClients);

// CRUD
router.post("/", verifyJwt, addClient);
router.get("/", verifyJwt, getAllClients);
router.get("/:id", verifyJwt, getClient);
router.patch("/:id", verifyJwt, updateClient);

// Password reset by admin (no current password required)
router.patch("/:id/password", verifyJwt, requireMainAdmin, changeClientPassword);

// Archive / Restore — Main Administrators only
router.patch("/:id/archive", verifyJwt, requireMainAdmin, archiveClient);
router.patch("/:id/restore", verifyJwt, requireMainAdmin, restoreClient);

export default router;
