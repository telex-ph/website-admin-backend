import z from "zod";

export const updateBlogSchema = z
  .object({
    title: z.string().min(3).optional(),
    content: z.string().min(10).optional(),
    // TODO: change the enum category, please notify hernani po.
    category: z.enum(["categor1", "categor2", "categor3"]).optional(),
    status: z.enum(["publish", "draft", "schedule"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateBlogDto = z.infer<typeof updateBlogSchema>;
