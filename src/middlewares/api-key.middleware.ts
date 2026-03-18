import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export const verifyApiKey = (req: Request, res: Response, next: NextFunction) => {
  const expectedSecret = process.env.BLOG_API_KEY;

  // ============================================
  // 🤖 SIGHT AI — Signature-based verification
  // Sight AI signs requests using HMAC SHA256
  // Headers sent: x-sightai-signature, x-sightai-timestamp, x-sightai-version
  // ============================================
  const sightaiSignature = req.headers["x-sightai-signature"] as string;
  const sightaiTimestamp = req.headers["x-sightai-timestamp"] as string;

  if (sightaiSignature && sightaiTimestamp) {
    console.log("🤖 [API-KEY] Sight AI webhook detected — using signature verification");

    if (!expectedSecret) {
      console.error("❌ [API-KEY] BLOG_API_KEY is not set in environment variables");
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    // Sight AI signs: timestamp + "." + raw body
    const rawBody = JSON.stringify(req.body);
    const payload = `${sightaiTimestamp}.${rawBody}`;

    const expectedSignature = "sha256=" + crypto
      .createHmac("sha256", expectedSecret)
      .update(payload)
      .digest("hex");

    console.log("🔑 [API-KEY] Received signature:", sightaiSignature);
    console.log("🔑 [API-KEY] Expected signature:", expectedSignature);

    // Use timingSafeEqual to prevent timing attacks
    const receivedBuf = Buffer.from(sightaiSignature);
    const expectedBuf = Buffer.from(expectedSignature);

    const isValid =
      receivedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(receivedBuf, expectedBuf);

    console.log("🔑 [API-KEY] Signature match?:", isValid);

    if (!isValid) {
      console.warn("⛔ [API-KEY] Invalid Sight AI signature — request rejected");
      return res.status(401).json({ message: "Unauthorized" });
    }

    console.log("✅ [API-KEY] Sight AI signature verified successfully");
    return next();
  }

  // ============================================
  // 🔑 FALLBACK — Simple x-api-key header check
  // For admin panel and other direct API calls
  // ============================================
  const receivedKey = req.headers["x-api-key"] as string;

  console.log("🔑 [API-KEY] Received x-api-key:", receivedKey);
  console.log("🔑 [API-KEY] Expected key:", expectedSecret);
  console.log("🔑 [API-KEY] Match?:", receivedKey === expectedSecret);

  if (!receivedKey || receivedKey !== expectedSecret) {
    console.warn("⛔ [API-KEY] Invalid API key — request rejected");
    return res.status(401).json({ message: "Unauthorized" });
  }

  console.log("✅ [API-KEY] API key verified successfully");
  return next();
};