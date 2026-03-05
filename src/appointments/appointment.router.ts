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
  getMyAppointments,
  getUpcomingAppointments,
} from "./appointment.controller.ts";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";

const appointmentRouter = Router();

// 🔓 PUBLIC ROUTES
appointmentRouter.get("/calendars", getCalendars);
appointmentRouter.get("/slots", getFreeSlots);
appointmentRouter.post("/", createAppointment);

// 🔒 PROTECTED ROUTES
appointmentRouter.post("/sync", forceSync);
appointmentRouter.post("/clear-and-resync", clearAndResync);
appointmentRouter.get("/", getAllAppointments);

// 👤 CLIENT — fetch only the logged-in client's appointments (filtered by email from JWT)
appointmentRouter.get("/my", verifyJwt, getMyAppointments);

// 📅 DASHBOARD WIDGET — next 5 upcoming appointments (admin only)
appointmentRouter.get("/upcoming", verifyJwt, getUpcomingAppointments);

// 🔍 DEBUG — inspect raw GHL response for a specific appointment
appointmentRouter.get("/debug/:appointmentId", debugAppointmentDetails);
appointmentRouter.get("/:appointmentId", getAppointmentById);
appointmentRouter.put("/:appointmentId", updateAppointment);
appointmentRouter.delete("/:appointmentId", deleteAppointment);
// ✅ CONFIRM — creates client account + sends login credentials via email
appointmentRouter.post("/:appointmentId/confirm", confirmAppointment);

export default appointmentRouter;