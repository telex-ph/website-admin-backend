import express from "express";
import { addBlog } from "../controllers/blog.controller.ts";
const router = express.Router();

router.post("/", addBlog);

export default router;
