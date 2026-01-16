import z, { ZodType } from "zod";

export const createBlogSchema: ZodType<{
  title: string;
  slug: string;
  content: string;
  tags: string[];
}> = z.object({
  title: z.string(),
  slug: z.string(),
  content: z.string(),
  tags: z.array(z.string().min(1, "At least one tag is required")),
});

export type CreateBlogDto = z.infer<typeof createBlogSchema>;
