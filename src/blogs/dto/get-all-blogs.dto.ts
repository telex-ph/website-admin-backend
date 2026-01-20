import z from "zod";

export const getAllBlogSchema = z.object({
  blogs: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
      category: z.string(),
      status: z.string(),
      author: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"),
    }),
  ),
});

export type CreateBlogDto = z.infer<typeof getAllBlogSchema>;
