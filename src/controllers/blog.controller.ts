import type { Request, Response } from "express";
import Blog from "../models/Blog.ts";

export const addBlog = async (req: Request, res: Response) => {
  const article = await Blog.create({
    title: "Awesome Post!",
    slug: "awesome-post",
    published: true,
    content: "This is the best post ever",
    tags: ["featured", "announcement"],
  });

  res.send(article);
};
