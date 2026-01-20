import z from "zod";

export const createBlogSchema = z.object({
  title: z.string(),
  content: z.string(),
  // TODO: make the category enum instead and apply to other DTO
  category: z.string(),
  status: z.enum(["published", "draft", "scheduled"]),
  author: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"),
});

export type CreateBlogDto = z.infer<typeof createBlogSchema>;
