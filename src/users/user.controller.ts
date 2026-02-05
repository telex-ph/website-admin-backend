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
    // Build user data object, only include profilePicture if it exists
    const userData: any = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      contactNumber: user.contactNumber,
      department: user.department,
      role: user.role,
      password: hashedPassword,
    };

    // Only add profilePicture if it's provided
    if (user.profilePicture) {
      userData.profilePicture = user.profilePicture;
    }

    const newUser = await User.create(userData);
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

// Fetching all users
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    // {} means all records or without a filter
    const users = await User.find({}).exec();
    res.status(200).json(users);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching users error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Users error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Get current logged-in user
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    // Get user from JWT middleware (req.user should be set by verifyJwt middleware)
    const userPayload = (req as any).user;
    
    if (!userPayload || !userPayload.id) {
      return res.status(401).json({ 
        error: "Unauthorized",
        message: "User not authenticated" 
      });
    }

    // Fetch user from database excluding password
    const user = await User.findById(userPayload.id).select('-password').exec();
    
    if (!user) {
      return res.status(404).json({ 
        error: "User not found",
        message: "User does not exist" 
      });
    }

    res.status(200).json(user);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching current user error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Current user error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const getUser = async (req: Request, res: Response) => {
  // Check the params using Zod/validation
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    const user = await User.findById(param.id).exec();
    res.status(200).json(user);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching user error:", error.message);
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

// Change password endpoint
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userPayload = (req as any).user;

    if (!userPayload || !userPayload.id) {
      return res.status(401).json({ 
        error: "Unauthorized",
        message: "User not authenticated" 
      });
    }

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Validation failed",
        message: "Current password and new password are required"
      });
    }

    // Fetch user with password
    const user = await User.findById(userPayload.id).exec();
    
    if (!user) {
      return res.status(404).json({ 
        error: "User not found",
        message: "User does not exist" 
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        error: "Invalid password",
        message: "Current password is incorrect"
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password using findByIdAndUpdate to bypass validation issues
    await User.findByIdAndUpdate(
      userPayload.id,
      { password: hashedPassword },
      { runValidators: false } // Disable validators to avoid casting errors
    ).exec();

    res.status(200).json({ 
      message: "Password changed successfully" 
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Change password error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Change password error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  // Check the params using Zod/validation
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    // Search for the id and delete
    const user = await User.findByIdAndDelete(param.id).exec();
    res.status(200).json(user);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Deleting user error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("User error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};