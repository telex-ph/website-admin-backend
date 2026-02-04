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

export const createCaseStudySchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  subtitle: z.string().optional(),
  author: z.string().min(2, "Author name must be at least 2 characters"),
  status: z.enum(["active", "completed", "draft", "scheduled"]),
  // UPDATED: Multiple tags support - can be empty array or have multiple values
  tags: z
    .array(
      z.enum(["technology", "logistics", "analytics", "infrastructure"])
    )
    .optional()
    .default([])
    .refine(
      (tags) => tags.length >= 0 && tags.length <= 4,
      { message: "You can select 0 to 4 categories" }
    ),
  
  // Date fields
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  isUnfinished: z.boolean().optional().default(false),
  scheduleDate: z.date().optional(),
  scheduleTime: z.string().optional(),
  
  // Content sections - exactly 5 sections required
  sections: z
    .array(contentSectionSchema)
    .length(5, "Exactly 5 content sections are required"),
  
  // Challenge - at least 1 required
  challenge: z
    .array(challengeSolutionSchema)
    .min(1, "At least one challenge is required"),
  
  // Solution - at least 1 required
  solution: z
    .array(challengeSolutionSchema)
    .min(1, "At least one solution is required"),
});

export type CreateCaseStudyDto = z.infer<typeof createCaseStudySchema>;