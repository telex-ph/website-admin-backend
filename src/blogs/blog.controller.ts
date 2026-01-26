import type { Request, Response } from "express";
import Blog from "./Blog.ts";
import { createBlogSchema, type CreateBlogDto } from "./dto/create-blog.dto.ts";
import { toSlug } from "../common/utils/to-slug.util.ts";
import {
  getParamSchema,
  type GetParamDto,
} from "../common/dto/get-param.dto.ts";
import { updateBlogSchema, type UpdateBlogDto } from "./dto/update-blog.dto.ts";
import { Types } from "mongoose";
import uploadFile from "../common/utils/upload-file.util.ts";

// Adding blog
export const addBlog = async (req: Request, res: Response) => {
  // Check the body using Zod/validation
  const parsed = createBlogSchema.safeParse(req.body);

  // Validate
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body does not match the expected schema",
    });
  }

  const blog: CreateBlogDto = parsed.data;

  try {
    // File uploading
    const file = req.file;
    if (!file?.buffer) throw new Error("File buffer is empty");
    const url = await uploadFile(file);

    // Create blog object
    const newBlog = await Blog.create({
      title: blog.title,
      slug: toSlug(blog.title),
      content: blog.content,
      category: blog.category,
      // author: blog.author,
      author: Types.ObjectId.createFromHexString(blog.author),
      status: blog.status,
      cover: url,
    });

    res.status(200).json(newBlog);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Adding blog error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Blog error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Fetching all blogs
export const getAllBlogs = async (req: Request, res: Response) => {
  try {
    // {} means all records or without a filter
    const blogs = await Blog.find({}).exec();
    res.status(200).json(blogs);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching blogs error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Blogs error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const getBlog = async (req: Request, res: Response) => {
  // Check the params using Zod/validation
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    const blog = await Blog.findById(param.id).exec();
    res.status(200).json(blog);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching blog error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Blogs error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const updateBlog = async (req: Request, res: Response) => {
  // Check the body using Zod/validation
  // Validate the params
  const parsedParams = getParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  // Validate the body
  const paraseBody = updateBlogSchema.safeParse(req.body);

  if (!paraseBody.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body do not match the expected schema",
    });
  }

  const param: GetParamDto = parsedParams.data;
  const body: UpdateBlogDto = paraseBody.data;

  try {
    // Search for the id and update
    const blog = await Blog.findByIdAndUpdate(param.id, body, {
      new: true,
      runValidators: true,
    }).exec();
    res.status(200).json(blog);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Updating blog error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Blogs error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const deleteBlog = async (req: Request, res: Response) => {
  // Check the params using Zod/validation
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    // Search for the id and delete
    const blog = await Blog.findByIdAndDelete(param.id).exec();
    res.status(200).json(blog);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Deleting blog error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Blogs error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};
