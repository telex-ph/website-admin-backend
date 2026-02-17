import z from "zod";

export const updateServiceSchema = z
  .object({
    serviceId: z.string().min(1, "Service ID is required").optional(),
    name: z.string().min(3, "Name must be at least 3 characters").optional(),
    description: z.string().min(10, "Description must be at least 10 characters").optional(),
    badge: z.string().min(1, "Badge is required").optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;