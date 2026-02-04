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
    subtitle: z.string().optional(),
    author: z.string().min(2, "Author name must be at least 2 characters").optional(),
    status: z.enum(["active", "completed", "draft", "scheduled"]).optional(),
    // UPDATED: Multiple tags support - can be empty array or have multiple values
    tags: z
      .array(
        z.enum(["technology", "logistics", "analytics", "infrastructure"])
      )
      .optional()
      .refine(
        (tags) => !tags || (tags.length >= 0 && tags.length <= 4),
        { message: "You can select 0 to 4 categories" }
      ),
    
    // Date fields
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    isUnfinished: z.boolean().optional(),
    scheduleDate: z.date().optional(),
    scheduleTime: z.string().optional(),
    
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