import express from "express";
import {
  addUser,
  getAllUsers,
  getCurrentUser,
  getUser,
  updateUser,
  changePassword,
  deleteUser,
} from "./user.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";
const router = express.Router();

// Get current logged-in user (must be before /:id route to avoid conflicts)
router.get("/me", verifyJwt, getCurrentUser);

// Change password endpoint
router.post("/change-password", verifyJwt, changePassword);

// Other user routes
router.post("/", verifyJwt, addUser);
router.get("/", verifyJwt, getAllUsers);
router.get("/:id", verifyJwt, getUser);
router.patch("/:id", verifyJwt, updateUser);
router.delete("/:id", verifyJwt, deleteUser);

export default router;