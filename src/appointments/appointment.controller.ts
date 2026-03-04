import type { Request, Response } from "express";
import Appointment, { type IAppointment } from "./appointment.model.ts";
import { createAppointmentSchema, type CreateAppointmentDto } from "./dto/create-appointment.dto.ts";
import { updateAppointmentSchema, type UpdateAppointmentDto } from "./dto/update-appointment.dto.ts";

// ============================================
// 🔑 GHL CONFIG (from .env)
// ============================================
const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_PRIVATE_KEY = process.env.GHL_PRIVATE_KEY || "pit-27d45f20-8e28-4348-b873-3ad68cac899e";
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || "KlBL9XEG0eVNlAqE7m5V";
const GHL_CALENDAR_ID = process.env.GHL_CALENDAR_ID || "https://api.leadconnectorhq.com/widget/booking/SGW2Z5bWhLtOfMQoi8mj";



const ghlHeaders = {
  Authorization: `Bearer ${GHL_PRIVATE_KEY}`,
  "Content-Type": "application/json",
  Version: "2021-04-15",
};

// ============================================
// 📅 GET ALL CALENDARS
// ============================================
export const getCalendars = async (req: Request, res: Response) => {
  try {
    if (!GHL_PRIVATE_KEY || !GHL_LOCATION_ID) {
      return res.status(500).json({ error: "GHL credentials are not configured. Set GHL_PRIVATE_KEY and GHL_LOCATION_ID in .env" });
    }
    const response = await fetch(`${GHL_BASE_URL}/calendars/?locationId=${GHL_LOCATION_ID}`, { headers: ghlHeaders });
    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: "Failed to fetch calendars from GHL", details: error });
    }
    const data = await response.json();
    return res.status(200).json(data.calendars || []);
  } catch (error) {
    if (error instanceof Error) {
      console.error("getCalendars error:", error.message);
      return res.status(400).json({ error: error.message });
    }
    return res.status(400).json({ error: "Unknown error occurred" });
  }
};

// ============================================
// 🕐 GET FREE SLOTS
// Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), timezone, calendarId
// ============================================
export const getFreeSlots = async (req: Request, res: Response) => {
  try {
    if (!GHL_PRIVATE_KEY) {
      return res.status(500).json({ error: "GHL_PRIVATE_KEY is not configured in .env" });
    }
    const calendarId = (req.query.calendarId as string) || GHL_CALENDAR_ID;
    const startDate  = req.query.startDate as string;
    const endDate    = req.query.endDate as string;
    const timezone   = (req.query.timezone as string) || "Asia/Manila";
    if (!calendarId) {
      return res.status(400).json({ error: "calendarId is required. Set GHL_CALENDAR_ID in .env or pass it as a query param." });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required query params (format: YYYY-MM-DD)" });
    }
    const startTimestamp = new Date(startDate).getTime();
    const endTimestamp   = new Date(endDate + "T23:59:59").getTime();
    const url = `${GHL_BASE_URL}/calendars/${calendarId}/free-slots?startDate=${startTimestamp}&endDate=${endTimestamp}&timezone=${encodeURIComponent(timezone)}`;
    const response = await fetch(url, { headers: ghlHeaders });
    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: "Failed to fetch free slots from GHL", details: error });
    }
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    if (error instanceof Error) {
      console.error("getFreeSlots error:", error.message);
      return res.status(400).json({ error: error.message });
    }
    return res.status(400).json({ error: "Unknown error occurred" });
  }
};

// ============================================
// ✅ CREATE APPOINTMENT → GHL + MongoDB
// ============================================
export const createAppointment = async (req: Request, res: Response) => {
  // Validate with Zod (same as blog pattern)
  const parsedBody = createAppointmentSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body does not match the expected schema",
      details: parsedBody.error.issues,
    });
  }
  const body: CreateAppointmentDto = parsedBody.data;
  try {
    if (!GHL_PRIVATE_KEY || !GHL_LOCATION_ID) {
      return res.status(500).json({ error: "GHL credentials are not configured. Set GHL_PRIVATE_KEY and GHL_LOCATION_ID in .env" });
    }
    const calendarId = body.calendarId || GHL_CALENDAR_ID;
    const locationId = body.locationId || GHL_LOCATION_ID;
    const payload = {
      calendarId,
      locationId,
      startTime: body.startTime,
      ...(body.endTime           && { endTime: body.endTime }),
      ...(body.title             && { title: body.title }),
      ...(body.appointmentStatus && { appointmentStatus: body.appointmentStatus }),
      ...(body.assignedUserId    && { assignedUserId: body.assignedUserId }),
      ...(body.address           && { address: body.address }),
      ...(body.ignoreDateRange   !== undefined && { ignoreDateRange: body.ignoreDateRange }),
      ...(body.toNotify          !== undefined && { toNotify: body.toNotify }),
      ...(body.contactId         && { contactId: body.contactId }),
      ...(body.email             && { email: body.email }),
      ...(body.phone             && { phone: body.phone }),
      ...(body.name              && { name: body.name }),
    };
    // 1️⃣ Save to GHL
    const ghlResponse = await fetch(`${GHL_BASE_URL}/calendars/events/appointments`, {
      method: "POST",
      headers: ghlHeaders,
      body: JSON.stringify(payload),
    });
    if (!ghlResponse.ok) {
      const ghlError = await ghlResponse.json();
      return res.status(ghlResponse.status).json({ error: "Failed to create appointment in GHL", details: ghlError });
    }
    const ghlData        = await ghlResponse.json();
    const ghlAppointment = ghlData.appointment || ghlData;
    // 2️⃣ Save to MongoDB
    const appointment = await Appointment.create({
      ghlAppointmentId:  ghlAppointment.id,
      calendarId,
      locationId,
      contactId:         ghlAppointment.contactId || body.contactId,
      name:              body.name,
      email:             body.email,
      phone:             body.phone,
      title:             body.title || ghlAppointment.title,
      startTime:         new Date(body.startTime),
      endTime:           body.endTime ? new Date(body.endTime) : undefined,
      appointmentStatus: body.appointmentStatus || "confirmed",
      assignedUserId:    body.assignedUserId || ghlAppointment.assignedUserId,
      address:           body.address,
    });
    return res.status(201).json(appointment);
  } catch (error) {
    if (error instanceof Error) {
      console.error("createAppointment error:", error.message);
      return res.status(400).json({ error: error.message });
    }
    return res.status(400).json({ error: "Unknown error occurred" });
  }
};

// ============================================
// 🔄 SYNC HELPER — pulls from GHL, upserts to MongoDB
// ============================================
const syncFromGHL = async (calendarId: string, startTime?: string, endTime?: string) => {
  const now        = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const oneYearFwd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  const startTs = startTime ? new Date(startTime).getTime() : oneYearAgo.getTime();
  const endTs   = endTime   ? new Date(endTime).getTime()   : oneYearFwd.getTime();

  const url = `${GHL_BASE_URL}/calendars/events?calendarId=${calendarId}&locationId=${GHL_LOCATION_ID}&startTime=${startTs}&endTime=${endTs}`;

  console.log("🔄 [SYNC] Fetching from GHL...");
  console.log("🔄 [SYNC] URL:", url);
  console.log("🔄 [SYNC] calendarId:", calendarId);
  console.log("🔄 [SYNC] locationId:", GHL_LOCATION_ID);

  const response = await fetch(url, { headers: ghlHeaders });

  // Log raw GHL response for debugging
  const rawData = await response.json();
  console.log("🔄 [SYNC] GHL response status:", response.status);
  console.log("🔄 [SYNC] GHL response keys:", Object.keys(rawData));
  console.log("🔄 [SYNC] GHL raw response:", JSON.stringify(rawData, null, 2));

  if (!response.ok) {
    console.error("❌ [SYNC] GHL fetch failed:", rawData);
    return { events: [], error: rawData };
  }

  const events: any[] = rawData.events || rawData.appointments || rawData.data || [];
  console.log(`🔄 [SYNC] Found ${events.length} events from GHL`);

  if (events.length === 0) {
    console.warn("⚠️ [SYNC] No events returned. Check calendarId and date range.");
    return { events: [], error: null };
  }

  // Upsert each GHL appointment into MongoDB
  const upserted = await Promise.all(
    events.map((event: any) => {
      console.log("🔄 [SYNC] Upserting event:", event.id, "|", event.title, "|", event.startTime);

      // Build update object — exclude undefined to satisfy exactOptionalPropertyTypes
      const updateDoc: Partial<IAppointment> = {
        ghlAppointmentId:  event.id,
        calendarId:        event.calendarId || calendarId,
        locationId:        event.locationId || GHL_LOCATION_ID,
        startTime:         new Date(event.startTime),
        appointmentStatus: event.appointmentStatus || "confirmed",
      };
      if (event.contactId)         updateDoc.contactId      = event.contactId;
      if (event.contact?.name)     updateDoc.name           = event.contact.name;
      if (event.title)             updateDoc.name           = updateDoc.name ?? event.title;
      if (event.contact?.email)    updateDoc.email          = event.contact.email;
      if (event.contact?.phone)    updateDoc.phone          = event.contact.phone;
      if (event.title)             updateDoc.title          = event.title;
      if (event.endTime)           updateDoc.endTime        = new Date(event.endTime);
      if (event.assignedUserId)    updateDoc.assignedUserId = event.assignedUserId;
      if (event.address)           updateDoc.address        = event.address;

      const syncFilter: { ghlAppointmentId: string } = { ghlAppointmentId: String(event.id) };
      return Appointment.findOneAndUpdate(
        syncFilter,
        updateDoc,
        { upsert: true, new: true, runValidators: false }
      );
    })
  );

  console.log(`✅ [SYNC] Upserted ${upserted.length} appointments to MongoDB`);
  return { events, error: null };
};

// ============================================
// 📋 GET ALL APPOINTMENTS — auto-syncs from GHL first
// Query params: status, email, startDate, endDate, calendarId
// ============================================
export const getAllAppointments = async (req: Request, res: Response) => {
  try {
    const { status, email, startDate, endDate } = req.query;
    const calendarId = (req.query.calendarId as string) || GHL_CALENDAR_ID;

    if (!calendarId) {
      return res.status(400).json({ error: "calendarId is required. Set GHL_CALENDAR_ID in .env or pass it as a query param." });
    }

    // 1️⃣ Pull latest from GHL and upsert to MongoDB
    const syncResult = await syncFromGHL(calendarId, startDate as string, endDate as string);
    console.log(`🔄 Sync complete — ${syncResult.events.length} events from GHL`);

    // 2️⃣ Query MongoDB with optional filters
    const filter: Record<string, any> = {};
    if (status)    filter["appointmentStatus"] = status;
    if (email)     filter["email"] = email;
    if (startDate) filter["startTime"] = { ...filter["startTime"], $gte: new Date(startDate as string) };
    if (endDate)   filter["startTime"] = { ...filter["startTime"], $lte: new Date((endDate as string) + "T23:59:59") };

    const appointments = await Appointment.find(filter).sort({ startTime: 1 }).exec();
    return res.status(200).json(appointments);
  } catch (error) {
    if (error instanceof Error) {
      console.error("getAllAppointments error:", error.message);
      return res.status(400).json({ error: error.message });
    }
    return res.status(400).json({ error: "Unknown error occurred" });
  }
};

// ============================================
// 📋 GET APPOINTMENT BY ID (from GHL)
// ============================================
export const getAppointmentById = async (req: Request, res: Response) => {
  try {
    if (!GHL_PRIVATE_KEY) {
      return res.status(500).json({ error: "GHL_PRIVATE_KEY is not configured in .env" });
    }
    const { appointmentId } = req.params;
    const response = await fetch(
      `${GHL_BASE_URL}/calendars/events/appointments/${appointmentId}`,
      { headers: ghlHeaders }
    );
    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: "Failed to fetch appointment from GHL", details: error });
    }
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    if (error instanceof Error) {
      console.error("getAppointmentById error:", error.message);
      return res.status(400).json({ error: error.message });
    }
    return res.status(400).json({ error: "Unknown error occurred" });
  }
};

// ============================================
// ✏️ UPDATE APPOINTMENT (GHL + MongoDB)
// ============================================
export const updateAppointment = async (req: Request, res: Response) => {
  // Validate with Zod (same as blog pattern)
  const parsedBody = updateAppointmentSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body does not match the expected schema",
      details: parsedBody.error.issues,
    });
  }
  const body: UpdateAppointmentDto = parsedBody.data;
  try {
    if (!GHL_PRIVATE_KEY) {
      return res.status(500).json({ error: "GHL_PRIVATE_KEY is not configured in .env" });
    }
    const { appointmentId } = req.params;
    // 1️⃣ Update in GHL
    const ghlResponse = await fetch(
      `${GHL_BASE_URL}/calendars/events/appointments/${appointmentId}`,
      { method: "PUT", headers: ghlHeaders, body: JSON.stringify(body) }
    );
    if (!ghlResponse.ok) {
      const ghlError = await ghlResponse.json();
      return res.status(ghlResponse.status).json({ error: "Failed to update appointment in GHL", details: ghlError });
    }
    // 2️⃣ Update in MongoDB
    const updateData: any = {};
    if (body.startTime)          updateData.startTime = new Date(body.startTime);
    if (body.endTime)            updateData.endTime   = new Date(body.endTime);
    if (body.title)              updateData.title     = body.title;
    if (body.appointmentStatus)  updateData.appointmentStatus = body.appointmentStatus;
    if (body.address)            updateData.address   = body.address;
    const updateFilter: { ghlAppointmentId: string } = { ghlAppointmentId: String(appointmentId) };
    const appointment = await Appointment.findOneAndUpdate(
      updateFilter,
      updateData,
      { new: true, runValidators: true }
    ).exec();
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found in database" });
    }
    return res.status(200).json(appointment);
  } catch (error) {
    if (error instanceof Error) {
      console.error("updateAppointment error:", error.message);
      return res.status(400).json({ error: error.message });
    }
    return res.status(400).json({ error: "Unknown error occurred" });
  }
};

// ============================================
// 🗑️ DELETE APPOINTMENT (GHL + MongoDB)
// ============================================
export const deleteAppointment = async (req: Request, res: Response) => {
  try {
    if (!GHL_PRIVATE_KEY) {
      return res.status(500).json({ error: "GHL_PRIVATE_KEY is not configured in .env" });
    }
    const { appointmentId } = req.params;
    // 1️⃣ Delete from GHL
    const ghlResponse = await fetch(
      `${GHL_BASE_URL}/calendars/events/appointments/${appointmentId}`,
      { method: "DELETE", headers: ghlHeaders }
    );
    if (!ghlResponse.ok) {
      const ghlError = await ghlResponse.json();
      return res.status(ghlResponse.status).json({ error: "Failed to delete appointment in GHL", details: ghlError });
    }
    // 2️⃣ Delete from MongoDB
    const deleteFilter: { ghlAppointmentId: string } = { ghlAppointmentId: String(appointmentId) };
    const appointment = await Appointment.findOneAndDelete(deleteFilter).exec();
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found in database" });
    }
    return res.status(200).json({ message: "Appointment deleted successfully", data: appointment });
  } catch (error) {
    if (error instanceof Error) {
      console.error("deleteAppointment error:", error.message);
      return res.status(400).json({ error: error.message });
    }
    return res.status(400).json({ error: "Unknown error occurred" });
  }
};