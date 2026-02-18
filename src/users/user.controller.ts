import type { Request, Response } from "express";
import { createUserSchema, type CreateUserDto } from "./dto/create-user.dto.ts";
import { updateUserSchema, type UpdateUserDto } from "./dto/update-user.dto.ts";
import {
  getParamSchema,
  type GetParamDto,
} from "../common/dto/get-param.dto.ts";
import bcrypt from "bcrypt";
import User from "./User.ts";
import ActivityLog from "../activity-logs/Activitylog.ts";

// Helper function to create activity log
const createActivityLog = async (
  action: "CREATED" | "UPDATED" | "DELETED" | "RESTORED",
  adminEmail: string,
  details: any,
  description?: string,
  changes?: { field: string; label: string; oldValue: any; newValue: any }[]
) => {
  try {
    const timestamp = new Date();
    const logData: any = {
      action,
      module: "ACCOUNT_SETTINGS",
      admin: adminEmail,
      details: {
        ...details,
        ...(changes && changes.length > 0 ? { changes } : {}),
        ...(description ? { description } : {}),
      },
      description: description || "",
      readBy: [adminEmail], // Admin who performed the action has already "read" it
    };

    // Set the appropriate timestamp field based on action
    if (action === "CREATED") {
      logData.createdAt = timestamp;
    } else if (action === "UPDATED") {
      logData.updatedAt = timestamp;
    } else if (action === "DELETED") {
      logData.deletedAt = timestamp;
    } else if (action === "RESTORED") {
      logData.restoredAt = timestamp;
    }

    await ActivityLog.create(logData);
  } catch (error) {
    console.error("Error creating activity log:", error);
    // Don't throw error - activity log failure shouldn't break the main operation
  }
};

// Helper to build field-level changes for account updates
const USER_FIELD_LABELS: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  contactNumber: "Contact Number",
  department: "Department",
  role: "Role",
};

const buildUserChanges = (
  previousValues: Record<string, any>,
  updatedFields: Record<string, any>
) => {
  const changes: { field: string; label: string; oldValue: any; newValue: any }[] = [];

  for (const field of Object.keys(updatedFields)) {
    if (!(field in USER_FIELD_LABELS)) continue;
    const oldVal = previousValues[field] ?? null;
    const newVal = updatedFields[field] ?? null;
    if (String(oldVal) === String(newVal)) continue;
    changes.push({
      field,
      label: USER_FIELD_LABELS[field]!,
      oldValue: oldVal,
      newValue: newVal,
    });
  }

  return changes;
};

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

    const newUser = await User.create(userData) as any;

    // Get admin email from JWT payload
    const adminEmail = (req as any).user?.email || "system";

    // Create activity log
    await createActivityLog(
      "CREATED",
      adminEmail,
      {
        userId: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        department: newUser.department,
        role: newUser.role,
        name: `${newUser.firstName} ${newUser.lastName}`,
      },
      `Created account for ${newUser.firstName} ${newUser.lastName} (${newUser.email})`
    );

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

// Fetching all users (only non-archived)
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    // Return users where isArchived is not true (covers false, null, undefined, and missing field)
    const users = await User.find({ isArchived: { $ne: true } }).exec();
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

// Fetching all archived users
export const getArchivedUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({ isArchived: true }).exec();
    res.status(200).json(users);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching archived users error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Archived users error:", error);
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
    // Get the user before update for logging purposes
    const oldUser = await User.findById(param.id).exec();
    
    // Search for the id and update
    const user = await User.findByIdAndUpdate(param.id, body as any, {
      new: true,
      runValidators: true,
    }).exec();

    // Get admin email from JWT payload
    const adminEmail = (req as any).user?.email || "system";

    // Create activity log with old and new values
    const previousValues = oldUser ? {
      firstName: oldUser.firstName,
      lastName: oldUser.lastName,
      email: oldUser.email,
      contactNumber: oldUser.contactNumber,
      department: oldUser.department,
      role: oldUser.role,
    } : {};
    const userChanges = buildUserChanges(previousValues, body);
    const changedLabels = userChanges.map((c) => c.label).join(", ");
    const fullName = `${user?.firstName} ${user?.lastName}`.trim();
    await createActivityLog(
      "UPDATED",
      adminEmail,
      {
        userId: user?._id,
        email: user?.email,
        name: fullName,
        updatedFields: body,
        previousValues,
      },
      `Updated account for ${fullName}${changedLabels ? ` — changed: ${changedLabels}` : ""}`,
      userChanges
    );

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
      { runValidators: false } as any // Disable validators to avoid casting errors
    ).exec();

    // Get admin email from JWT payload
    const adminEmail = userPayload.email || "system";

    // Create activity log for password change
    await createActivityLog(
      "UPDATED",
      adminEmail,
      {
        userId: userPayload.id,
        email: user.email,
        action: "Password Changed",
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`,
      },
      `Changed password for ${user.firstName} ${user.lastName} (${user.email})`
    );

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

export const archiveUser = async (req: Request, res: Response) => {
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
    // Get the user before archiving for logging purposes
    const userToArchive = await User.findById(param.id).exec();

    if (!userToArchive) {
      return res.status(404).json({
        error: "User not found",
        message: "User does not exist",
      });
    }

    // Set isArchived to true instead of deleting
    const user = await User.findByIdAndUpdate(
      param.id,
      { isArchived: true },
      { new: true, runValidators: false } as any
    ).exec();

    // Get admin email from JWT payload
    const adminEmail = (req as any).user?.email || "system";

    // Create activity log
    await createActivityLog(
      "DELETED",
      adminEmail,
      {
        userId: userToArchive._id,
        email: userToArchive.email,
        firstName: userToArchive.firstName,
        lastName: userToArchive.lastName,
        department: userToArchive.department,
        role: userToArchive.role,
        name: `${userToArchive.firstName} ${userToArchive.lastName}`,
      },
      `Archived account for ${userToArchive.firstName} ${userToArchive.lastName} (${userToArchive.email})`
    );

    res.status(200).json(user);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Archiving user error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("User error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Restore an archived user
export const restoreUser = async (req: Request, res: Response) => {
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    const userToRestore = await User.findById(param.id).exec();

    if (!userToRestore) {
      return res.status(404).json({
        error: "User not found",
        message: "User does not exist",
      });
    }

    if (!userToRestore.isArchived) {
      return res.status(400).json({
        error: "Bad request",
        message: "User is not archived",
      });
    }

    const user = await User.findByIdAndUpdate(
      param.id,
      { isArchived: false },
      { new: true, runValidators: false } as any
    ).exec();

    // Get admin email from JWT payload
    const adminEmail = (req as any).user?.email || "system";

    // Create activity log
    await createActivityLog(
      "RESTORED",
      adminEmail,
      {
        userId: userToRestore._id,
        email: userToRestore.email,
        firstName: userToRestore.firstName,
        lastName: userToRestore.lastName,
        department: userToRestore.department,
        role: userToRestore.role,
        name: `${userToRestore.firstName} ${userToRestore.lastName}`,
      },
      `Restored account for ${userToRestore.firstName} ${userToRestore.lastName} (${userToRestore.email})`
    );

    res.status(200).json(user);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Restoring user error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("User error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const updateTheme = async (req: Request, res: Response) => {
  try {
    const { darkMode } = req.body;
    const userPayload = (req as any).user;

    if (!userPayload || !userPayload.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Update lang yung darkMode field
    await User.findByIdAndUpdate(
      userPayload.id,
      { darkMode: darkMode },
      { runValidators: false } as any
    ).exec();

    res.status(200).json({ message: "Theme updated successfully" });
  } catch (error: unknown) {
    console.error("Update theme error:", error);
    res.status(400).json({ error: "Failed to update theme" });
  }
};