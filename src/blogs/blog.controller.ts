import type { Request, Response } from "express";
import Blog from "./Blog.ts";

export const addBlog = async (req: Request, res: Response) => {
  try {
    const article = await Blog.create({
      title: "Awesome Post!",
      slug: "awesome-post",
      published: true,
      content: "This is the best post ever",
      tags: ["featured", "announcement"],
    });

    res.status(200).json(article);
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
