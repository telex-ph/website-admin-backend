import z from "zod";

export const createClientSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  contactNumber: z.string(),
  profilePicture: z.string().optional(),
  // TODO: use regex here, with proper password complexity
  password: z.string(),
});

export type CreateClientDto = z.infer<typeof createClientSchema>;
