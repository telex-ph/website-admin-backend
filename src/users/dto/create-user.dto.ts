import z, { ZodType } from "zod";

export const createUserSchema: ZodType<{
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}> = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  // TODO: use regex here, with proper password complexity
  password: z.string(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
