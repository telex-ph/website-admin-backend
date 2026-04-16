import z from "zod";

export const updateClientSchema = z
  .object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.email().optional(),
    contactNumber: z.string().optional(),
    profilePicture: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateClientDto = z.infer<typeof updateClientSchema>;
