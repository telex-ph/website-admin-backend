import express from "express";
import { addUser, updateUser } from "./user.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";
const router = express.Router();

router.post("/", verifyJwt, addUser);
router.patch("/:id", verifyJwt, updateUser);

export default router;
