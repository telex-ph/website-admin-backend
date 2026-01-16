import type { Request, Response } from "express";
import User from "../models/User.ts";

export const addUser = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    const newUser = await User.create({
      email,
      // TODO: change this later. or maybe add to a const file
      role: "admin",
      // TODO: use bycrpt later
      password: "$2a$10$1jHppZ6SOnm4wnTMDg0kPOY9FHu/0L31MdP50WaeGmnVkLpeLPpau",
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
