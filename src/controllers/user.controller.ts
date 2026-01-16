import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import User from "../models/User.ts";

export const addUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Safe guards. Means all fields are required
  if (!email) throw new Error("Email is required");
  if (!password) throw new Error("Password is required");

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const newUser = await User.create({
      email,
      // TODO: change this later. or maybe add to a const file
      role: "admin",
      password: hashedPassword,
    });
    res.status(200).json(newUser);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Adding blog error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Blog error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};
