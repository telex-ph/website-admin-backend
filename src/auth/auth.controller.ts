import type { Request, Response } from "express";
import User from "../users/User.ts";
import * as jose from "jose";
import bcrypt from "bcrypt";
import {
  createAccessToken,
  createRefreshToken,
} from "./helpers/create-token.helper.ts";
import type { AuthPayload } from "./types/auth-payload.type.ts";
import { logActivity } from "../common/services/activity-log.service.ts";

// This value should be in milliseconds
const ACCESS_TOKEN_EXPIRATION_MS = 8 * 60 * 60 * 1000; // 8 hours
const REFRESH_TOKEN_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// 🔧 Determine if we're in production or development
const isProduction = process.env.NODE_ENV === 'production';

export const authenticate = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // Safe guards. Means all fields are required
    if (!email) throw new Error("Email is required");
    if (!password) throw new Error("Password is required");

    // Fetch user
    const user = await User.findOne({ email }).exec();
    if (!user) throw new Error("User not found");

    // Compare hashed password to user input
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Invalid credentials");

    // Check if user is archived
    if (user.isArchived) throw new Error("Account is deactivated. Please contact the administrator.");

    // Token creation - NOW INCLUDES USER ID!
    const accessToken = await createAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });
    const refreshToken = await createRefreshToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });
    
    // 🔥 FIXED: Different cookie settings for dev vs production
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction, // Only secure in production (HTTPS)
      sameSite: isProduction ? 'none' as const : 'lax' as const, // 'lax' works with localhost
      path: "/",
    };

    // Store access token cookie
    res.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: ACCESS_TOKEN_EXPIRATION_MS,
    });

    // Store refresh token cookie
    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_EXPIRATION_MS,
    });

    console.log('✅ Cookies set successfully:', {
      environment: isProduction ? 'production' : 'development',
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite
    });

    // 🔴 LOG ACTIVITY - User Login
    await logActivity({
      action: "LOGIN",
      module: "AUTH",
      admin: email,
      details: {
        userId: user._id.toString(),
        role: user.role,
        loginTime: new Date(),
      },
      req,
    });

    res.status(200).json({ message: "Successfully authenticated" });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Authentication error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Authentication error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const refresh = async (req: Request, res: Response) => {
  const publicPEM = process.env.PUBLIC_KEY;
  if (!publicPEM) throw new Error("Public key is empty");

  // Client-related check
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ code: "REFRESH_TOKEN_EXPIRED" });
  }

  try {
    // Import the public key to check the validity of the token
    const publicKey = await jose.importSPKI(publicPEM, "RS256");
    const verified = await jose.jwtVerify(refreshToken, publicKey);
    const payload: AuthPayload = verified.payload as AuthPayload;
    
    // Create new access token
    const accessToken = await createAccessToken({
      id: payload.id,
      email: payload.email,
      role: payload.role,
    });

    // Store in cookie with same settings as login
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' as const : 'lax' as const,
      path: "/",
      maxAge: ACCESS_TOKEN_EXPIRATION_MS,
    });

    res.json({ access_token: accessToken, expires_in: 28800 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Refresh token error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Refresh token error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const logout = async (req: Request, res: Response) => {
  // Get user email before clearing cookies
  const user = (req as any).user;
  const email = user?.email || "unknown@admin.com";

  // Clear cookies with same settings
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' as const : 'lax' as const,
    path: "/",
    expires: new Date(0),
  };

  res.cookie("accessToken", "", cookieOptions);
  res.cookie("refreshToken", "", cookieOptions);

  // 🔴 LOG ACTIVITY - User Logout
  await logActivity({
    action: "LOGOUT",
    module: "AUTH",
    admin: email,
    details: {
      logoutTime: new Date(),
    },
    req,
  });

  res.json({ message: "Logged out successfully", isLoggedOut: true });
};