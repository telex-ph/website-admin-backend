import express from "express";
import { addUser } from "./user.controller.ts";
const router = express.Router();

router.post("/", addUser);

export default router;
