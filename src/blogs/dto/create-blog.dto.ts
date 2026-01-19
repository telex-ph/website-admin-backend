import z, { ZodType } from "zod";

export const createBlogSchema: ZodType<{
  title: string;
  content: string;
  category: string;
  status: string;
  author: string;
}> = z.object({
  title: z.string(),
  content: z.string(),
  category: z.string(),
  status: z.string(),
  author: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"),
});

export type CreateBlogDto = z.infer<typeof createBlogSchema>;
