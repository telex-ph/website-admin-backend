import z from "zod";

// Schema for content sections (subtitle/text pairs)
const contentSectionSchema = z.object({
  subtitle: z.string().min(3, "Subtitle must be at least 3 characters"),
  text: z.string().min(10, "Text must be at least 10 characters"),
});

// Schema for challenge/solution items
const challengeSolutionSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  text: z.string().min(10, "Text must be at least 10 characters"),
});

export const updateCaseStudySchema = z
  .object({
    title: z.string().min(3).optional(),
    status: z.enum(["active", "completed", "draft", "scheduled"]).optional(),
    tags: z
      .array(
        z.enum(["technology", "logistics", "analytics", "infrastructure"])
      )
      .optional(),
    
    // Content sections - if provided, must be exactly 5
    sections: z.array(contentSectionSchema).length(5).optional(),
    
    // Challenge - if provided, must have at least 1
    challenge: z.array(challengeSolutionSchema).min(1).optional(),
    
    // Solution - if provided, must have at least 1
    solution: z.array(challengeSolutionSchema).min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateCaseStudyDto = z.infer<typeof updateCaseStudySchema>;