import type { Request, Response } from "express";
import User from "../users/User.ts";
import * as jose from "jose";
import bcrypt from "bcrypt";
import {
  createAccessToken,
  createRefreshToken,
} from "./helpers/create-token.helper.ts";
import type { AuthPayload } from "./types/auth-payload.type.ts";

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

    // Token creation
    const accessToken = await createAccessToken({
      email: user.email,
      role: user.role,
    });
    const refreshToken = await createRefreshToken({
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

    res.status(200).json({ message: "Sucessfully authenticated" });
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
    // Create new access token using refresh token
    const accessToken = await createAccessToken({
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

  res.json({ message: "Logged out successfully", isLoggedOut: true });
};
