import type { Request, Response } from "express";
import { createUserSchema, type CreateUserDto } from "./dto/create-user.dto.ts";
import { updateUserSchema, type UpdateUserDto } from "./dto/update-user.dto.ts";
import {
  getParamSchema,
  type GetParamDto,
} from "../common/dto/get-param.dto.ts";
import bcrypt from "bcrypt";
import User from "./User.ts";

export const addUser = async (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body do not match the expected schema",
    });
  }

  const user: CreateUserDto = parsed.data;

  const hashedPassword = await bcrypt.hash(user.password, 10);

  try {
    const newUser = await User.create({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      // TODO: change this later. or maybe add to a const file
      role: "admin",
      password: hashedPassword,
    });
    res.status(200).json(newUser);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Adding user error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("User error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const updateUser = async (req: Request, res: Response) => {
  // Validate the params
  const parsedParams = getParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  // Checkin
  const paraseBody = updateUserSchema.safeParse(req.body);
  if (!paraseBody.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body do not match the expected schema",
    });
  }

  const param: GetParamDto = parsedParams.data;
  const body: UpdateUserDto = paraseBody.data;

  try {
    // Search for the id and update
    const user = await User.findByIdAndUpdate(param.id, body, {
      new: true,
      runValidators: true,
    }).exec();
    res.status(200).json(user);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Updating user error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("User error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};
