import z from "zod";

export const updateUserSchema = z
  .object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.email().optional(),
    contactNumber: z.string().optional(),
    profilePicture: z.string().optional(),
    department: z.number().int().min(1).max(5).optional(), // 1: Compliance, 2: Innovation, 3: Marketing, 4: Recruitment, 5: Human Resources
    role: z.number().int().min(1).max(2).optional(), // 1: Main Admin, 2: Admin
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
