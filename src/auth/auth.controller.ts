import type { Request, Response } from "express";
import User from "../users/User.ts";
import Client from "../client/Client.ts";
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

// ============================================
// 👤 CLIENT AUTHENTICATE
// POST /auth/client/authenticate
// ============================================
export const authenticateClient = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    if (!email) throw new Error("Email is required");
    if (!password) throw new Error("Password is required");

    // Find client by email
    const client = await Client.findOne({ email }).exec();

    if (!client) throw new Error("Invalid credentials");

    // Compare hashed password
    const isMatch = await bcrypt.compare(password, client.password);
    if (!isMatch) throw new Error("Invalid credentials");

    // Check if client is archived
    if (client.isArchived) throw new Error("Account is deactivated. Please contact the administrator.");

    // Role 0 = client
    const accessToken = await createAccessToken({
      id: client._id.toString(),
      email: client.email,
      role: 0,
    });
    const refreshToken = await createRefreshToken({
      id: client._id.toString(),
      email: client.email,
      role: 0,
    });

    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' as const : 'lax' as const,
      path: "/",
    };

    res.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: ACCESS_TOKEN_EXPIRATION_MS,
    });

    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_EXPIRATION_MS,
    });

    console.log('✅ Client login successful:', email);

    res.status(200).json({
      message: "Successfully authenticated",
      client: {
        id: client._id.toString(),
        email: client.email,
        firstName: client.firstName,
        lastName: client.lastName,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Client authentication error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Client authentication error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// ============================================
// 👤 CLIENT SELF-REGISTRATION
// POST /auth/client/register
// Public — no JWT required
// ============================================
export const registerClient = async (req: Request, res: Response) => {
  const { firstName, lastName, email, contactNumber, password } = req.body;

  try {
    if (!firstName) throw new Error("First name is required");
    if (!lastName) throw new Error("Last name is required");
    if (!email) throw new Error("Email is required");
    if (!contactNumber) throw new Error("Contact number is required");
    if (!password) throw new Error("Password is required");

    // Check for duplicate email
    const existing = await Client.findOne({ email }).exec();
    if (existing) {
      return res.status(409).json({
        error: "Conflict",
        message: "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newClient = await Client.create({
      firstName,
      lastName,
      email,
      contactNumber,
      password: hashedPassword,
    }) as any;

    console.log("✅ New client registered:", email);

    // Strip password from response
    const { password: _pw, ...safeClient } = newClient.toObject();
    res.status(201).json({
      message: "Account created successfully",
      client: safeClient,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Client registration error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
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

// ============================================
// 👤 GET CURRENT CLIENT PROFILE
// GET /auth/client/me
// Protected — requires verifyJwt middleware
// Uses the id from the verified JWT payload to
// fetch and return the full client document.
// ============================================
export const getClientProfile = async (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload;

  try {
    const client = await Client.findById(user.id).select("-password").exec();

    if (!client) {
      return res.status(404).json({
        error: "Not found",
        message: "Client account not found",
      });
    }

    if (client.isArchived) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Account is deactivated",
      });
    }

    res.status(200).json({
      id: client._id.toString(),
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      contactNumber: client.contactNumber,
      profilePicture: client.profilePicture ?? null,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("getClientProfile error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};