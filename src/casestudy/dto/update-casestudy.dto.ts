import z from "zod";

export const updateCaseStudySchema = z
  .object({
    title: z.string().min(3).optional(),
    content: z.string().min(10).optional(),
    status: z.enum(["published", "draft", "scheduled"]).optional(),
    client: z.string().min(2).optional(),
    industry: z.string().min(2).optional(),
    challenge: z.string().min(10).optional(),
    solution: z.string().min(10).optional(),
    results: z.string().min(10).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateCaseStudyDto = z.infer<typeof updateCaseStudySchema>;