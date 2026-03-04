import z from "zod";

export const updateAppointmentSchema = z.object({
  startTime:  z.string().optional(),
  endTime:    z.string().optional(),
  title:      z.string().optional(),
  appointmentStatus: z.enum(["confirmed", "cancelled", "showed", "noshow", "invalid"]).optional(),
  assignedUserId: z.string().optional(),
  address:    z.string().optional(),
})
.refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided",
});

export type UpdateAppointmentDto = z.infer<typeof updateAppointmentSchema>;
