import z from "zod";

export const updateServiceSchema = z
  .object({
    serviceId: z.string().min(1, "Service ID is required").optional(),
    name: z.string().min(3, "Name must be at least 3 characters").optional(),
    description: z.string().min(10, "Description must be at least 10 characters").optional(),
    badge: z.string().min(1, "Badge is required").optional(),
    isActive: z
      .union([z.boolean(), z.string().transform((v) => v === "true")])
      .optional(),
    // ✅ Accept string, null, undefined, or empty string (empty string from FormData = "clear photo")
    coverPhoto: z.string().nullable().optional(),
    inactivePhoto: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      // At least one field must be provided
      return Object.keys(data).length > 0;
    },
    { message: "At least one field must be provided" }
  );

export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;