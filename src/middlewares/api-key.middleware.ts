import type { Request, Response, NextFunction } from "express";

export const verifyApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.BLOG_API_KEY) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};