import express from "express";
import {
  addBlog,
  getBlog,
  getAllBlogs,
  updateBlog,
  deleteBlog,
} from "./blog.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";
const router = express.Router();

router.get("/", getAllBlogs);

router.get("/:id", getBlog);

router.post("/", verifyJwt, addBlog);

router.patch("/:id", verifyJwt, updateBlog);

router.delete("/:id", verifyJwt, deleteBlog);

export default router;
