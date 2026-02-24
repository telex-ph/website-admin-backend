import * as jose from "jose";
import type { Request, Response, NextFunction } from "express";

// Ine-extend ang Request para payagan si 'user' property sa TypeScript
interface AuthenticatedRequest extends Request {
  user?: any;
}

const isProduction = process.env.NODE_ENV === 'production';

/**
 * 🔒 STRICT AUTH MIDDLEWARE
 * Use this for protected routes that REQUIRE authentication
 * Checks BOTH cookies and Authorization header
 */
export const verifyJwt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const publicPEM = process.env.PUBLIC_KEY;
  if (!publicPEM) throw new Error("Public key is empty");

  // Check BOTH cookies and Authorization header
  let accessToken = req.cookies.accessToken;
  
  // If no token in cookies, check Authorization header
  if (!accessToken) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    }
  }

  try {
    if (accessToken) {
      const publicKey = await jose.importSPKI(publicPEM, "RS256");
      const { payload } = await jose.jwtVerify(accessToken, publicKey);

      req.user = payload;
      return next();
    } else {
      res.clearCookie('accessToken', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/'
      });
      
      return res.status(401).json({
        success: false,
        message: "No access token provided. Please login.",
        redirectTo: "/login"
      });
    }
  } catch (error) {
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/'
    });
    
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token. Please login again.",
      redirectTo: "/login"
    });
  }
};


/**
 * 🔓 OPTIONAL AUTH MIDDLEWARE
 * Use this for routes that work for BOTH authenticated and public users
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const publicPEM = process.env.PUBLIC_KEY;
  if (!publicPEM) {
    return next();
  }

  // Check BOTH cookies and Authorization header
  let accessToken = req.cookies.accessToken;
  
  if (!accessToken) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }
  }

  if (!accessToken) {
    return next();
  }

  try {
    const publicKey = await jose.importSPKI(publicPEM, "RS256");
    const { payload } = await jose.jwtVerify(accessToken, publicKey);

    req.user = payload;
    return next();
  } catch (error) {
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/'
    });
    
    return next();
  }
};