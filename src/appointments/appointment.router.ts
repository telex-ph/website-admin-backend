import { Router } from "express";
import {
  getCalendars,
  getFreeSlots,
  createAppointment,
  getAllAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
} from "./appointment.controller.ts";

const appointmentRouter = Router();

// 🔓 PUBLIC ROUTES
appointmentRouter.get("/calendars", getCalendars);
appointmentRouter.get("/slots", getFreeSlots);
appointmentRouter.post("/", createAppointment);

// 🔒 PROTECTED ROUTES
appointmentRouter.get("/", getAllAppointments);
appointmentRouter.get("/:appointmentId", getAppointmentById);
appointmentRouter.put("/:appointmentId", updateAppointment);
appointmentRouter.delete("/:appointmentId", deleteAppointment);

export default appointmentRouter;