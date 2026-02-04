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
const ACCESS_TOKEN_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
    
    // Store a token cookie
    // I used httpOnly to prevent XSS
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: ACCESS_TOKEN_EXPIRATION_MS,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: REFRESH_TOKEN_EXPIRATION_MS,
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
    
    // Create new access token - NOW INCLUDES USER ID FROM REFRESH TOKEN!
    const accessToken = await createAccessToken({
      id: payload.id,
      email: payload.email,
      role: payload.role,
    });

    // Store in cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: ACCESS_TOKEN_EXPIRATION_MS,
    });

    res.json({ access_token: accessToken, expires_in: 300 });
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

  res.cookie("accessToken", "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    expires: new Date(0),
  });

  res.cookie("refreshToken", "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    expires: new Date(0),
  });

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