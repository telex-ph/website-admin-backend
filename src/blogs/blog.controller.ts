import type { Request, Response } from "express";
import Blog from "./Blog.ts";
import { createBlogSchema, type CreateBlogDto } from "./dto/create-blog.dto.ts";

export const addBlog = async (req: Request, res: Response) => {
  const parsed = createBlogSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Zod Error. Invalid request data",
    });
  }

  const blog: CreateBlogDto = parsed.data;

  try {
    const neBlog = await Blog.create({
      title: blog.title,
      slug: blog.slug,
      content: blog.content,
      tags: blog.tags,
    });

    res.status(200).json(neBlog);
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
