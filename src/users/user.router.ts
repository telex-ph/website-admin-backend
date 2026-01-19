import express from "express";
import { addUser } from "./user.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";
const router = express.Router();

router.post("/", verifyJwt, addUser);

export default router;
