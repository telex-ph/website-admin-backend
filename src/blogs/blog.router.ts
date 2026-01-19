import express from "express";
import { addBlog } from "./blog.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";
const router = express.Router();

// router.get("/");

router.post("/", verifyJwt, addBlog);

export default router;
