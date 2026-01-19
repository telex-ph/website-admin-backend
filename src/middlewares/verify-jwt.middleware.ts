import * as jose from "jose";
import type { Request, Response, NextFunction } from "express";

export const verifyJwt = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const publicPEM = process.env.PUBLIC_KEY;
  if (!publicPEM) throw new Error("Public key is empty");

  const accessToken = req.cookies.accessToken;

  try {
    if (accessToken) {
      // Import the public key to check the validity of the token
      const publicKey = await jose.importSPKI(publicPEM, "RS256");
      // Validate the accessToken
      const { payload } = await jose.jwtVerify(accessToken, publicKey);

      req.user = payload;
      return next();
    } else {
      return res.status(401).json({ code: "ACCESS_TOKEN_EXPIRED" });
    }
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return res.status(401).json({ code: "ACCESS_TOKEN_EXPIRED" });
    }
    console.error("JWT verification error:", error);
    return res.status(403).json({ message: "Invalid access token" });
  }
};
