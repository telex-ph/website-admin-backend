import z from "zod";

export const createCaseStudySchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  status: z.enum(["published", "draft", "scheduled"]),
  client: z.string().min(2, "Client name is required"),
  industry: z.string().min(2, "Industry is required"),
  challenge: z.string().min(10, "Challenge description is required"),
  solution: z.string().min(10, "Solution description is required"),
  results: z.string().min(10, "Results description is required"),
  author: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"),
});

export type CreateCaseStudyDto = z.infer<typeof createCaseStudySchema>;