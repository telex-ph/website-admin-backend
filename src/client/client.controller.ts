import type { Request, Response } from "express";
import { createClientSchema, type CreateClientDto } from "./dto/create-client.dto.ts";
import { updateClientSchema, type UpdateClientDto } from "./dto/update-client.dto.ts";
import {
  getParamSchema,
  type GetParamDto,
} from "../common/dto/get-param.dto.ts";
import bcrypt from "bcrypt";
import Client from "./Client.ts";
import ActivityLog from "../activity-logs/Activitylog.ts";

// ─── Activity Log Helper ──────────────────────────────────────────────────────

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
      module: "CLIENT_MANAGEMENT",
      admin: adminEmail,
      details: {
        ...details,
        ...(changes && changes.length > 0 ? { changes } : {}),
        ...(description ? { description } : {}),
      },
      description: description || "",
      readBy: [adminEmail],
    };

    if (action === "CREATED") logData.createdAt = timestamp;
    else if (action === "UPDATED") logData.updatedAt = timestamp;
    else if (action === "DELETED") logData.deletedAt = timestamp;
    else if (action === "RESTORED") logData.restoredAt = timestamp;

    await ActivityLog.create(logData);
  } catch (error) {
    console.error("Error creating activity log:", error);
  }
};

// ─── Field-Level Change Tracking ─────────────────────────────────────────────

const CLIENT_FIELD_LABELS: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  contactNumber: "Contact Number",
};

const buildClientChanges = (
  previousValues: Record<string, any>,
  updatedFields: Record<string, any>
) => {
  const changes: { field: string; label: string; oldValue: any; newValue: any }[] = [];

  for (const field of Object.keys(updatedFields)) {
    if (!(field in CLIENT_FIELD_LABELS)) continue;
    const oldVal = previousValues[field] ?? null;
    const newVal = updatedFields[field] ?? null;
    if (String(oldVal) === String(newVal)) continue;
    changes.push({
      field,
      label: CLIENT_FIELD_LABELS[field]!,
      oldValue: oldVal,
      newValue: newVal,
    });
  }

  return changes;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

export const addClient = async (req: Request, res: Response) => {
  const parsed = createClientSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body does not match the expected schema",
    });
  }

  const client: CreateClientDto = parsed.data;
  const hashedPassword = await bcrypt.hash(client.password, 10);

  try {
    const clientData: any = {
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      contactNumber: client.contactNumber,
      password: hashedPassword,
    };

    if (client.profilePicture) {
      clientData.profilePicture = client.profilePicture;
    }

    const newClient = await Client.create(clientData) as any;
    const adminEmail = (req as any).user?.email || "system";

    await createActivityLog(
      "CREATED",
      adminEmail,
      {
        clientId: newClient._id,
        email: newClient.email,
        firstName: newClient.firstName,
        lastName: newClient.lastName,
        name: `${newClient.firstName} ${newClient.lastName}`,
      },
      `Created client account for ${newClient.firstName} ${newClient.lastName} (${newClient.email})`
    );

    res.status(200).json(newClient);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Adding client error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const getAllClients = async (req: Request, res: Response) => {
  try {
    const clients = await Client.find({ isArchived: { $ne: true } }).exec();
    res.status(200).json(clients);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching clients error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const getArchivedClients = async (req: Request, res: Response) => {
  try {
    const clients = await Client.find({ isArchived: true }).exec();
    res.status(200).json(clients);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching archived clients error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const getClient = async (req: Request, res: Response) => {
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    const client = await Client.findById(param.id).select("-password").exec();

    if (!client) {
      return res.status(404).json({
        error: "Not found",
        message: "Client does not exist",
      });
    }

    res.status(200).json(client);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching client error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const updateClient = async (req: Request, res: Response) => {
  const parsedParams = getParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const parsedBody = updateClientSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body does not match the expected schema",
    });
  }

  const param: GetParamDto = parsedParams.data;
  const body: UpdateClientDto = parsedBody.data;

  try {
    const existingClient = await Client.findById(param.id).exec();

    if (!existingClient) {
      return res.status(404).json({
        error: "Not found",
        message: "Client does not exist",
      });
    }

    // Capture previous values for change tracking
    const previousValues: Record<string, any> = {};
    for (const field of Object.keys(body)) {
      previousValues[field] = (existingClient as any)[field];
    }

    const client = await Client.findByIdAndUpdate(param.id, body, {
      new: true,
      runValidators: true,
    }).exec();

    const adminEmail = (req as any).user?.email || "system";
    const fullName = `${existingClient.firstName} ${existingClient.lastName}`;
    const clientChanges = buildClientChanges(previousValues, body);
    const changedLabels = clientChanges.map((c) => c.label).join(", ");

    await createActivityLog(
      "UPDATED",
      adminEmail,
      {
        clientId: existingClient._id,
        email: existingClient.email,
        name: fullName,
        updatedFields: body,
        previousValues,
      },
      `Updated client account for ${fullName}${changedLabels ? ` — changed: ${changedLabels}` : ""}`,
      clientChanges
    );

    res.status(200).json(client);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Updating client error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const changeClientPassword = async (req: Request, res: Response) => {
  try {
    const parsed = getParamSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        message: "Request parameters do not match the expected schema",
      });
    }

    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({
        error: "Validation failed",
        message: "newPassword is required",
      });
    }

    const client = await Client.findById(parsed.data.id).exec();
    if (!client) {
      return res.status(404).json({
        error: "Not found",
        message: "Client does not exist",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await Client.findByIdAndUpdate(
      parsed.data.id,
      { password: hashedPassword },
      { runValidators: false } as any
    ).exec();

    const adminEmail = (req as any).user?.email || "system";
    await createActivityLog(
      "UPDATED",
      adminEmail,
      {
        clientId: client._id,
        email: client.email,
        name: `${client.firstName} ${client.lastName}`,
        action: "Password Reset",
      },
      `Reset password for client ${client.firstName} ${client.lastName} (${client.email})`
    );

    res.status(200).json({ message: "Client password updated successfully" });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Change client password error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const archiveClient = async (req: Request, res: Response) => {
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    const clientToArchive = await Client.findById(param.id).exec();

    if (!clientToArchive) {
      return res.status(404).json({
        error: "Not found",
        message: "Client does not exist",
      });
    }

    if (clientToArchive.isArchived) {
      return res.status(400).json({
        error: "Bad request",
        message: "Client is already archived",
      });
    }

    const client = await Client.findByIdAndUpdate(
      param.id,
      { isArchived: true },
      { new: true, runValidators: false } as any
    ).exec();

    const adminEmail = (req as any).user?.email || "system";

    await createActivityLog(
      "DELETED",
      adminEmail,
      {
        clientId: clientToArchive._id,
        email: clientToArchive.email,
        firstName: clientToArchive.firstName,
        lastName: clientToArchive.lastName,
        name: `${clientToArchive.firstName} ${clientToArchive.lastName}`,
      },
      `Archived client account for ${clientToArchive.firstName} ${clientToArchive.lastName} (${clientToArchive.email})`
    );

    res.status(200).json(client);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Archiving client error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

export const restoreClient = async (req: Request, res: Response) => {
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    const clientToRestore = await Client.findById(param.id).exec();

    if (!clientToRestore) {
      return res.status(404).json({
        error: "Not found",
        message: "Client does not exist",
      });
    }

    if (!clientToRestore.isArchived) {
      return res.status(400).json({
        error: "Bad request",
        message: "Client is not archived",
      });
    }

    const client = await Client.findByIdAndUpdate(
      param.id,
      { isArchived: false },
      { new: true, runValidators: false } as any
    ).exec();

    const adminEmail = (req as any).user?.email || "system";

    await createActivityLog(
      "RESTORED",
      adminEmail,
      {
        clientId: clientToRestore._id,
        email: clientToRestore.email,
        firstName: clientToRestore.firstName,
        lastName: clientToRestore.lastName,
        name: `${clientToRestore.firstName} ${clientToRestore.lastName}`,
      },
      `Restored client account for ${clientToRestore.firstName} ${clientToRestore.lastName} (${clientToRestore.email})`
    );

    res.status(200).json(client);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Restoring client error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};
