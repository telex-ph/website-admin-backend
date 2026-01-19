import type { Request, Response } from "express";
import User from "../users/User.ts";
import bcrypt from "bcrypt";
import createToken from "../helpers/create-token.ts";

// This value should be in milliseconds
const ACCESS_TOKEN_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Safe guards. Means all fields are required
  if (!email) throw new Error("Email is required");
  if (!password) throw new Error("Password is required");

  try {
    // Fetch user
    const user = await User.findOne({ email }).exec();
    if (!user) throw new Error("User not found");

    // Compare hashed password to user input
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Invalid credentials");

    const response = await createToken({ email: user.email, role: user.role });

    // Store a token cookie
    // I used httpOnly to prevent XSS
    res.cookie("accessToken", response.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: ACCESS_TOKEN_EXPIRATION_MS,
    });

    res.cookie("refreshToken", response.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: REFRESH_TOKEN_EXPIRATION_MS,
    });

    res.status(200).json({ message: "Sucessfully authenticated" });
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
