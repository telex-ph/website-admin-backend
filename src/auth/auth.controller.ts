import type { Request, Response } from "express";
import User from "../users/User.ts";
import bcrypt from "bcrypt";
import createToken from "../helpers/create-token.ts";
import { createAuthorizationCode } from "./utils/create-auth-code.ts";
import { redis } from "../config/redis.client.ts";

// This value should be in milliseconds
const ACCESS_TOKEN_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// export const login = async (req: Request, res: Response) => {
//   const { email, password } = req.body;

//   // Safe guards. Means all fields are required
//   if (!email) throw new Error("Email is required");
//   if (!password) throw new Error("Password is required");

//   try {
//     // Fetch user
//     const user = await User.findOne({ email }).exec();
//     if (!user) throw new Error("User not found");

//     // Compare hashed password to user input
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) throw new Error("Invalid credentials");

//     const response = await createToken({ email: user.email, role: user.role });

//     // Store a token cookie
//     // I used httpOnly to prevent XSS
//     res.cookie("accessToken", response.accessToken, {
//       httpOnly: true,
//       secure: true,
//       sameSite: "none",
//       path: "/",
//       maxAge: ACCESS_TOKEN_EXPIRATION_MS,
//     });

//     res.cookie("refreshToken", response.refreshToken, {
//       httpOnly: true,
//       secure: true,
//       sameSite: "none",
//       path: "/",
//       maxAge: REFRESH_TOKEN_EXPIRATION_MS,
//     });

//     res.status(200).json({ message: "Sucessfully authenticated" });
//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       console.error("Login error:", error.message);
//       res.status(400).json({ error: error.message });
//     } else {
//       console.error("Login error:", error);
//       res.status(400).json({ error: "Unknown error occurred" });
//     }
//   }
// };

export const authorize = async (req: Request, res: Response) => {
  const { email, password, client_id, redirect_uri } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });
  if (!client_id || !redirect_uri)
    return res.status(400).json({ error: "Client info required" });

  try {
    // Check the user
    const user = await User.findOne({ email });
    if (!user) throw new Error("User not found");

    // Compare the passwith with the hashed password in the database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Invalid credentials");

    // Redis
    const code = await createAuthorizationCode({
      userId: user._id.toString(),
      clientId: client_id,
    });

    const redirectUrl = `${redirect_uri}?code=${code}`;
    res.redirect(redirectUrl);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Login error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Login error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const token = async (req: Request, res: Response) => {
  const { code, client_id } = req.body;

  // Validate code from Redis
  const value = await redis.get(code);
  if (!value) return res.status(400).json({ error: "Invalid or expired code" });

  const { userId, clientId: storedClientId } = JSON.parse(value);
  if (storedClientId !== client_id)
    return res.status(400).json({ error: "Client mismatch" });

  // Delete the code, since one-time use only
  await redis.del(code);

  const response = await createToken({ userId });

  res.json({
    access_token: response.accessToken,
    refresh_token: response.refreshToken,
  });
};
