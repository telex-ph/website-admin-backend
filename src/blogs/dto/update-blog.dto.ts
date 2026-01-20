import z from "zod";

export const updateBlogSchema = z
  .object({
    title: z.string().min(3).optional(),
    content: z.string().min(10).optional(),
    category: z.string().optional(),
    status: z.enum(["published", "draft", "scheduled"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateBlogDto = z.infer<typeof updateBlogSchema>;
