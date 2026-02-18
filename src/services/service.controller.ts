import type { Request, Response } from "express";
import Service, { type IService } from "./Service.ts";
import { createServiceSchema, type CreateServiceDto } from "./dto/create-service.dto.ts";
import { updateServiceSchema, type UpdateServiceDto } from "./dto/update-service.dto.ts";
import {
  getParamSchema,
  type GetParamDto,
} from "../common/dto/get-param.dto.ts";
import { logActivity, getUserEmailFromRequest } from "../common/services/activity-log.service.ts";

// ============================================
// 🆕 ADD SERVICE
// ============================================
export const addService = async (req: Request, res: Response) => {
  const parsedBody = createServiceSchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body does not match the expected schema",
      details: parsedBody.error.issues,
    });
  }

  const body: CreateServiceDto = parsedBody.data;

  try {
    const newService: Partial<IService> = {
      serviceId: body.serviceId,
      name: body.name,
      description: body.description,
      badge: body.badge,
      isActive: body.isActive !== undefined ? body.isActive : false,
      coverPhoto: body.coverPhoto ?? null,
    } as any;
 
    const service = await Service.create(newService);

    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "CREATED",
      module: "SERVICES" as any,
      admin: adminEmail,
      details: {
        serviceId: service._id.toString(),
        name: service.name,
        isActive: service.isActive,
      },
      req,
    });

    res.status(201).json(service);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Adding service error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// ============================================
// 📋 GET ALL SERVICES
// ============================================
export const getAllServices = async (req: Request, res: Response) => {
  try {
    const { search, isActive, sortBy, order } = req.query;

    const filter: any = {};

    // Search functionality (checks name, description, and badge)
    if (search && typeof search === "string" && search.trim() !== "") {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
        { badge: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // FIX: query params are always strings — check for the literal 'true'/'false'
    // values explicitly instead of just `!== undefined` (which is always true
    // once the param is present in the URL).
    if (isActive === "true" || isActive === "false") {
      filter.isActive = isActive === "true";
    }

    // Sorting Logic
    const sort: any = {};
    if (sortBy && typeof sortBy === "string") {
      sort[sortBy] = order === "desc" ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }

    const services = await Service.find(filter).sort(sort).exec();
    res.status(200).json(services);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// ============================================
// 🆔 GET SERVICE BY ID
// ============================================
export const getService = async (req: Request, res: Response) => {
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Invalid ID format",
    });
  }

  const { id } = parsed.data;

  try {
    const service = await Service.findById(id).exec();
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }
    res.status(200).json(service);
  } catch (error) {
    res.status(400).json({ error: "Error fetching service" });
  }
};

// ============================================
// 🔗 GET SERVICE BY SERVICE_ID
// ============================================
export const getServiceByServiceId = async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    if (!serviceId) return res.status(400).json({ error: "Service ID is required" });

    const service = await Service.findOne({ serviceId }).exec();
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }
    res.status(200).json(service);
  } catch (error) {
    res.status(400).json({ error: "Error fetching service by serviceId" });
  }
};

// ============================================
// 📝 UPDATE SERVICE
// ============================================
export const updateService = async (req: Request, res: Response) => {
  const parsedBody = updateServiceSchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsedBody.error.issues,
    });
  }

  const body: UpdateServiceDto = parsedBody.data;
  const parsedParams = getParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({ error: "Invalid ID format" });
  }
  const { id } = parsedParams.data;

  try {
    const existingService = await Service.findById(id).exec();
    if (!existingService) {
      return res.status(404).json({ error: "Service not found" });
    }

    const oldData = { ...existingService.toObject() };

    const updateData: Partial<IService> = {} as any;

    if (body.serviceId !== undefined) updateData.serviceId = body.serviceId;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.badge !== undefined) updateData.badge = body.badge;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // ✅ FIX: use !== undefined instead of "in" operator — Zod strips absent keys from
    // its parsed output, so "coverPhoto" in body is false even when the client sends
    // coverPhoto: null explicitly. With !== undefined, null is correctly treated as
    // "clear the photo" and the field is properly included in the update.
    if (body.coverPhoto !== undefined) updateData.coverPhoto = (body.coverPhoto ?? null) as any;

    const updatedService = await Service.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).exec();

    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "UPDATED",
      module: "SERVICES" as any,
      admin: adminEmail,
      details: {
        serviceId: updatedService?._id?.toString() ?? '',
        oldData: { name: oldData.name, isActive: oldData.isActive },
        newData: { name: updatedService?.name, isActive: updatedService?.isActive },
        fieldsUpdated: Object.keys(body),
      },
      req,
    });

    res.status(200).json(updatedService);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// ============================================
// 🔄 TOGGLE SERVICE STATUS
// ============================================
export const toggleServiceStatus = async (req: Request, res: Response) => {
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Invalid ID format",
    });
  }

  const { id } = parsed.data;

  try {
    const service = await Service.findById(id).exec();
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const oldStatus = service.isActive;
    service.isActive = !service.isActive;
    await service.save();

    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "UPDATED",
      module: "SERVICES" as any,
      admin: adminEmail,
      details: {
        serviceId: service._id.toString(),
        name: service.name,
        statusChanged: {
          from: oldStatus,
          to: service.isActive,
        },
      },
      req,
    });

    res.status(200).json(service);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// ============================================
// 🗑️ DELETE SERVICE
// ============================================
export const deleteService = async (req: Request, res: Response) => {
  const parsed = getParamSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });

  try {
    const service = await Service.findByIdAndDelete(parsed.data.id).exec();
    if (!service) return res.status(404).json({ error: "Service not found" });

    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "DELETED",
      module: "SERVICES" as any,
      admin: adminEmail,
      details: {
        serviceId: service._id.toString(),
        name: service.name,
      },
      req,
    });

    res.status(200).json({ message: "Service deleted successfully", data: service });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Error deleting service",
    });
  }
};