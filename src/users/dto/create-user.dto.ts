import z, { ZodType } from "zod";

export const createUserSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  contactNumber: z.string(),
  profilePicture: z.string().optional(),
  department: z.number().int().min(1).max(5), // 1: Compliance, 2: Innovation, 3: Marketing, 4: Recruitment, 5: Human Resources
  role: z.number().int().min(1).max(2), // 1: Main Admin, 2: Admin
  // TODO: use regex here, with proper password complexity
  password: z.string(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
