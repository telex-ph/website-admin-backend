import express from "express";
import {
  addUser,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
} from "./user.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";
const router = express.Router();

router.post("/", verifyJwt, addUser);
router.get("/", verifyJwt, getAllUsers);
router.get("/:id", verifyJwt, getUser);
router.patch("/:id", verifyJwt, updateUser);
router.delete("/:id", verifyJwt, deleteUser);

export default router;
