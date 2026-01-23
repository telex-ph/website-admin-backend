import z from "zod";

export const createBlogSchema = z.object({
  title: z.string(),
  content: z.string(),
  // TODO: make the category enum instead and apply to other DTO
  status: z.enum(["publish", "draft", "schedule"]),
  // TODO: change the enum category, please notify hernani po.
  category: z.enum(["categor1", "categor2", "categor3"]),
  author: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"),
});

export type CreateBlogDto = z.infer<typeof createBlogSchema>;
