import z from "zod";

export const createServiceSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required"),
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  badge: z.string().min(1, "Badge is required"),
  isActive: z.boolean().optional().default(false),
  coverPhoto: z.string().optional().nullable(),
  inactivePhoto: z.string().optional().nullable(),
});
 
export type CreateServiceDto = z.infer<typeof createServiceSchema>;