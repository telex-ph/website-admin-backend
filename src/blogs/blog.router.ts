import express from "express";
import { addBlog } from "./blog.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.ts";
const router = express.Router();

router.post("/", verifyJwt, addBlog);

export default router;
