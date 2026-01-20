import z, { ZodType } from "zod";

export const getParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"),
});

export type GetParamDto = z.infer<typeof getParamSchema>;
