import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export const verifyApiKey = (req: Request, res: Response, next: NextFunction) => {
  const expectedSecret = process.env.BLOG_API_KEY;

  // ============================================
  // 🤖 SIGHT AI — Signature-based verification
  // ============================================
  const sightaiSignature = req.headers["x-sightai-signature"] as string;
  const sightaiTimestamp = req.headers["x-sightai-timestamp"] as string;

  if (sightaiSignature && sightaiTimestamp) {
    console.log("🤖 [API-KEY] Sight AI webhook detected — debugging signature");
    console.log("📨 [DEBUG] Received signature :", sightaiSignature);
    console.log("⏱️  [DEBUG] Timestamp          :", sightaiTimestamp);

    if (!expectedSecret) {
      console.error("❌ [API-KEY] BLOG_API_KEY not set");
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    const rawBody = JSON.stringify(req.body);

    // ============================================
    // 🔬 TRY ALL KNOWN PAYLOAD FORMATS
    // Log each one so we can find which matches
    // ============================================

    // Format 1: timestamp.body (Stripe-style)
    const payload1 = `${sightaiTimestamp}.${rawBody}`;
    const sig1 = "sha256=" + crypto.createHmac("sha256", expectedSecret).update(payload1).digest("hex");

    // Format 2: body only (no timestamp)
    const sig2 = "sha256=" + crypto.createHmac("sha256", expectedSecret).update(rawBody).digest("hex");

    // Format 3: timestamp + body (no dot separator)
    const payload3 = `${sightaiTimestamp}${rawBody}`;
    const sig3 = "sha256=" + crypto.createHmac("sha256", expectedSecret).update(payload3).digest("hex");

    // Format 4: raw hex body only (no sha256= prefix)
    const sig4 = crypto.createHmac("sha256", expectedSecret).update(rawBody).digest("hex");

    console.log("🔬 [DEBUG] Format 1 (timestamp.body)   :", sig1);
    console.log("🔬 [DEBUG] Format 2 (body only)        :", sig2);
    console.log("🔬 [DEBUG] Format 3 (timestampbody)    :", sig3);
    console.log("🔬 [DEBUG] Format 4 (raw hex body only):", "sha256=" + sig4);
    console.log("🔬 [DEBUG] Received signature           :", sightaiSignature);

    const matchedFormat =
      sightaiSignature === sig1 ? "Format 1 (timestamp.body)" :
      sightaiSignature === sig2 ? "Format 2 (body only)" :
      sightaiSignature === sig3 ? "Format 3 (timestampbody)" :
      sightaiSignature === ("sha256=" + sig4) ? "Format 4 (raw hex)" :
      null;

    if (matchedFormat) {
      console.log(`✅ [API-KEY] Signature MATCHED using: ${matchedFormat}`);
      return next();
    }

    // ============================================
    // ⚠️ TEMPORARY BYPASS — for debugging only
    // Remove return next() below after finding format
    // ============================================
    console.warn("⚠️  [API-KEY] No format matched — allowing through for debugging");
    console.warn("⚠️  [API-KEY] REMOVE THIS BYPASS after finding the correct format!");
    return next(); // ← REMOVE THIS LINE after debugging
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