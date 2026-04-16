import z from "zod";

export const createAppointmentSchema = z.object({
  calendarId: z.string().optional(),
  locationId: z.string().optional(),
  contactId:  z.string().optional(),
  startTime:  z.string().min(1, "startTime is required"),
  endTime:    z.string().optional(),
  title:      z.string().optional(),
  appointmentStatus: z.enum(["confirmed", "cancelled", "showed", "noshow", "invalid"]).optional(),
  assignedUserId: z.string().optional(),
  address:    z.string().optional(),
  ignoreDateRange: z.boolean().optional(),
  toNotify:   z.boolean().optional(),
  email:      z.string().email("Invalid email format").optional(),
  phone:      z.string().optional(),
  name:       z.string().optional(),
})
.refine((data) => !!data.email || !!data.contactId, {
  message: "Either email or contactId is required",
  path: ["email"],
});

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
