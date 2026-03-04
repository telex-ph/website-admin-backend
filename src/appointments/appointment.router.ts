import { Router } from "express";
import {
  getCalendars,
  getFreeSlots,
  createAppointment,
  getAllAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  forceSync,
  clearAndResync,
  debugAppointmentDetails,
  confirmAppointment,
} from "./appointment.controller.ts";

const appointmentRouter = Router();

// 🔓 PUBLIC ROUTES
appointmentRouter.get("/calendars", getCalendars);
appointmentRouter.get("/slots", getFreeSlots);
appointmentRouter.post("/", createAppointment);

// 🔒 PROTECTED ROUTES
appointmentRouter.post("/sync", forceSync);
appointmentRouter.post("/clear-and-resync", clearAndResync);
appointmentRouter.get("/", getAllAppointments);
// 🔍 DEBUG — inspect raw GHL response for a specific appointment
appointmentRouter.get("/debug/:appointmentId", debugAppointmentDetails);
appointmentRouter.get("/:appointmentId", getAppointmentById);
appointmentRouter.put("/:appointmentId", updateAppointment);
appointmentRouter.delete("/:appointmentId", deleteAppointment);
// ✅ CONFIRM — creates client account + sends login credentials via email
appointmentRouter.post("/:appointmentId/confirm", confirmAppointment);

export default appointmentRouter;