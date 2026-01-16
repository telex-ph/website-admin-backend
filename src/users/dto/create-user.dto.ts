import z, { ZodType } from "zod";

export const createUserSchema: ZodType<{
  email: string;
  password: string;
}> = z.object({
  email: z.email(),
  // TODO: use regex here, with proper password complexity
  password: z.string(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
