import type { Request, Response, NextFunction } from "express";

export const verifyApiKey = (req: Request, res: Response, next: NextFunction) => {
  const receivedKey = req.headers["x-api-key"];
  const expectedKey = process.env.BLOG_API_KEY;

  // 🔍 DEBUG LOGS — tanggalin mo ito pagkatapos maayos
  console.log("🔑 [API-KEY] Received key:", receivedKey);
  console.log("🔑 [API-KEY] Expected key:", expectedKey);
  console.log("🔑 [API-KEY] Match?:", receivedKey === expectedKey);
  console.log("🔑 [API-KEY] All headers:", JSON.stringify(req.headers));

  if (!receivedKey || receivedKey !== expectedKey) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};