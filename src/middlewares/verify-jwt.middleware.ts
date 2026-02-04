import * as jose from "jose";
import type { Request, Response, NextFunction } from "express";

// Ine-extend ang Request para payagan si 'user' property sa TypeScript
interface AuthenticatedRequest extends Request {
  user?: any;
}

export const verifyJwt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const publicPEM = process.env.PUBLIC_KEY;
  if (!publicPEM) throw new Error("Public key is empty");

  const accessToken = req.cookies.accessToken;

  try {
    if (accessToken) {
      const publicKey = await jose.importSPKI(publicPEM, "RS256");
      const { payload } = await jose.jwtVerify(accessToken, publicKey);

      req.user = payload;
      return next();
    } else {
      // Return 401 Unauthorized para ma-handle ng frontend
      return res.status(401).json({
        success: false,
        message: "No access token provided. Please login.",
        redirectTo: "/login"
      });
    }
  } catch (error) {
    console.error("JWT verification error:", error);
    
    // Return 401 kapag expired o invalid ang token
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token. Please login again.",
      redirectTo: "/login"
    });
  }
};