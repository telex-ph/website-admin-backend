import mongoose from "mongoose";
import type { Request, Response } from "express";
import Appointment, { type IAppointment } from "./appointment.model.ts";
import { createAppointmentSchema, type CreateAppointmentDto } from "./dto/create-appointment.dto.ts";
import { updateAppointmentSchema, type UpdateAppointmentDto } from "./dto/update-appointment.dto.ts";
import Client from "../client/Client.ts";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import { google } from "googleapis";

// ============================================
// 📧 GMAIL OAUTH2 CONFIG (from .env)
// ============================================
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? null,
});

const createGmailTransporter = async () => {
  const { token: accessToken } = await oauth2Client.getAccessToken();
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.GMAIL_USER,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      accessToken: accessToken || "",
    },
  });
};

const FROM_EMAIL = process.env.GMAIL_USER || "";
const CLIENT_PORTAL_URL = process.env.CLIENT_PORTAL_URL || "http://localhost:3001";

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
// 🔍 FETCH ENRICHED APPOINTMENT DATA FROM MULTIPLE GHL ENDPOINTS
// GHL's appointment endpoint does NOT return assignedUserName, calendarName,
// contact details, etc. We must fetch these separately.
// ============================================

// Fetch contact details (name, email, phone) from GHL
const fetchGHLContact = async (contactId: string): Promise<any | null> => {
  try {
    const response = await fetch(`${GHL_BASE_URL}/contacts/${contactId}`, { headers: ghlHeaders });
    if (!response.ok) return null;
    const data = await response.json();
    return data.contact || data;
  } catch {
    return null;
  }
};

// Fetch user details (name) from GHL
const fetchGHLUser = async (userId: string): Promise<any | null> => {
  try {
    const response = await fetch(`${GHL_BASE_URL}/users/${userId}`, { headers: ghlHeaders });
    if (!response.ok) return null;
    const data = await response.json();
    return data;
  } catch {
    return null;
  }
};

// Fetch calendar details (name) from GHL
const fetchGHLCalendar = async (calendarId: string): Promise<any | null> => {
  try {
    const response = await fetch(`${GHL_BASE_URL}/calendars/${calendarId}`, { headers: ghlHeaders });
    if (!response.ok) return null;
    const data = await response.json();
    return data.calendar || data;
  } catch {
    return null;
  }
};

// ============================================
// 🔍 DEBUG ENDPOINT — returns raw GHL appointment + enriched data
// GET /appointments/debug/:appointmentId
// ============================================
export const debugAppointmentDetails = async (req: Request, res: Response) => {
  try {
    if (!GHL_PRIVATE_KEY) {
      return res.status(500).json({ error: "GHL_PRIVATE_KEY is not configured in .env" });
    }
    const { appointmentId } = req.params;
    const apptResponse = await fetch(
      `${GHL_BASE_URL}/calendars/events/appointments/${appointmentId}`,
      { headers: ghlHeaders }
    );
    const apptData = await apptResponse.json();
    const appt = apptData.appointment || apptData;

    // Also fetch enriched data so we can debug what each endpoint returns
    const [contact, user, calendar] = await Promise.all([
      appt.contactId      ? fetchGHLContact(appt.contactId)      : null,
      appt.assignedUserId ? fetchGHLUser(appt.assignedUserId)     : null,
      appt.calendarId     ? fetchGHLCalendar(appt.calendarId)     : null,
    ]);

    return res.status(apptResponse.status).json({
      appointment: appt,
      enriched: { contact, user, calendar },
    });
  } catch (error) {
    if (error instanceof Error) {
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

    const assignedUserId = body.assignedUserId || ghlAppointment.assignedUserId;
    const contactId      = ghlAppointment.contactId || body.contactId;

    // 2️⃣ Enrich with data from separate GHL endpoints
    const [contact, user, calendar] = await Promise.all([
      contactId      ? fetchGHLContact(contactId)           : null,
      assignedUserId ? fetchGHLUser(assignedUserId)         : null,
      calendarId     ? fetchGHLCalendar(calendarId)         : null,
    ]);

    const contactFullName = contact
      ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.name
      : undefined;
    const userName = user
      ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name
      : undefined;

    // 3️⃣ Save to MongoDB (including enriched detail fields)
    const appointment = await Appointment.create({
      ghlAppointmentId:  ghlAppointment.id,
      calendarId,
      locationId,
      contactId,
      name:              body.name || contactFullName,
      email:             body.email || contact?.email,
      phone:             body.phone || contact?.phone,
      title:             body.title || ghlAppointment.title,
      startTime:         new Date(body.startTime),
      endTime:           body.endTime ? new Date(body.endTime) : undefined,
      appointmentStatus: body.appointmentStatus || "confirmed",
      assignedUserId,
      address:           body.address || ghlAppointment.address,
      // ✅ Enriched fields
      assignedUserName:  userName,
      calendarName:      calendar?.name,
      location:          body.address || ghlAppointment.address,
      attendees:         contactFullName ? [contactFullName] : [],
      bookedBy:          ghlAppointment.createdBy?.userId || undefined,
      source:            ghlAppointment.createdBy?.source
                           ? ghlAppointment.createdBy.source.replace(/_/g, " ").replace(/\w/g, (c: string) => c.toUpperCase())
                           : undefined,
      description:       undefined,
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

  // ✅ Pre-fetch unique users and calendars once to avoid duplicate calls
  const uniqueUserIds     = [...new Set(events.map((e: any) => e.assignedUserId).filter(Boolean))];
  const uniqueCalendarIds = [...new Set(events.map((e: any) => e.calendarId || calendarId).filter(Boolean))];

  const [userMap, calendarMap] = await Promise.all([
    Promise.all(uniqueUserIds.map(async (id) => {
      const user = await fetchGHLUser(id as string);
      return [id, user] as [string, any];
    })).then(Object.fromEntries),
    Promise.all(uniqueCalendarIds.map(async (id) => {
      const cal = await fetchGHLCalendar(id as string);
      return [id, cal] as [string, any];
    })).then(Object.fromEntries),
  ]);

  // Upsert each GHL appointment into MongoDB with enriched data
  const upserted = await Promise.all(
    events.map(async (event: any) => {
      console.log("🔄 [SYNC] Upserting event:", event.id, "|", event.title, "|", event.startTime);

      // ✅ Fetch contact details for this appointment
      const contact = event.contactId ? await fetchGHLContact(event.contactId) : null;

      // Resolve from pre-fetched maps
      const user     = event.assignedUserId ? userMap[event.assignedUserId] : null;
      const calendar = calendarMap[event.calendarId || calendarId] || null;

      // Build update object — exclude undefined to satisfy exactOptionalPropertyTypes
      const updateDoc: Partial<IAppointment> = {
        ghlAppointmentId:  event.id,
        calendarId:        event.calendarId || calendarId,
        locationId:        event.locationId || GHL_LOCATION_ID,
        startTime:         new Date(event.startTime),
        appointmentStatus: event.appointmentStatus || "confirmed",
      };
      if (event.contactId)      updateDoc.contactId      = event.contactId;
      if (event.title)          updateDoc.title          = event.title;
      if (event.endTime)        updateDoc.endTime        = new Date(event.endTime);
      if (event.assignedUserId) updateDoc.assignedUserId = event.assignedUserId;
      if (event.address)        updateDoc.address        = event.address;

      // ✅ Contact details (name, email, phone, attendees)
      if (contact) {
        const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || contact.name;
        if (fullName)          updateDoc.name      = fullName;
        if (contact.email)     updateDoc.email     = contact.email;
        if (contact.phone)     updateDoc.phone     = contact.phone;
        // Attendee = the contact who booked
        updateDoc.attendees = [fullName || contact.email].filter(Boolean);
      }

      // ✅ Assigned user name
      if (user) {
        const userName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name;
        if (userName) updateDoc.assignedUserName = userName;
      }

      // ✅ Calendar name
      if (calendar?.name) updateDoc.calendarName = calendar.name;

      // ✅ Location — GHL stores this as "address" on the appointment
      if (event.address) updateDoc.location = event.address;

      // ✅ Source — from createdBy.source on the event
      if (event.createdBy?.source) {
        // Convert "third_party" → "Third Party" for display
        updateDoc.source = event.createdBy.source
          .replace(/_/g, " ")
          .replace(/\w/g, (c: string) => c.toUpperCase());
      }

      // ✅ bookedBy — userId who created it (null if third party / self-booked)
      if (event.createdBy?.userId) updateDoc.bookedBy = event.createdBy.userId;

      return Appointment.findOneAndUpdate(
        { ghlAppointmentId: event.id as string },
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

    // Query MongoDB with optional filters
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
    const appointment = await Appointment.findOneAndUpdate(
      { ghlAppointmentId: appointmentId as string },
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
// 🔁 FORCE SYNC — re-pulls all appointments from GHL and upserts to MongoDB
// POST /appointments/sync
// ============================================
export const forceSync = async (req: Request, res: Response) => {
  try {
    if (!GHL_PRIVATE_KEY || !GHL_LOCATION_ID) {
      return res.status(500).json({ error: "GHL credentials are not configured." });
    }
    const calendarId = (req.query.calendarId as string) || GHL_CALENDAR_ID;
    if (!calendarId) {
      return res.status(400).json({ error: "calendarId is required. Set GHL_CALENDAR_ID in .env or pass as query param." });
    }
    const result = await syncFromGHL(calendarId);
    if (result.error) {
      return res.status(502).json({ error: "GHL sync failed", details: result.error });
    }
    return res.status(200).json({
      message: `✅ Sync complete. ${result.events.length} appointments upserted from GHL.`,
      count: result.events.length,
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error("forceSync error:", error.message);
      return res.status(400).json({ error: error.message });
    }
    return res.status(400).json({ error: "Unknown error occurred" });
  }
};

// ============================================
// 🗑️ CLEAR & RESYNC — deletes ALL local appointments then re-pulls from GHL
// POST /appointments/clear-and-resync
// ============================================
export const clearAndResync = async (req: Request, res: Response) => {
  try {
    if (!GHL_PRIVATE_KEY || !GHL_LOCATION_ID) {
      return res.status(500).json({ error: "GHL credentials are not configured." });
    }
    const calendarId = (req.query.calendarId as string) || GHL_CALENDAR_ID;
    if (!calendarId) {
      return res.status(400).json({ error: "calendarId is required." });
    }

    // 1️⃣ Delete all existing appointments from MongoDB
    const deleteResult = await Appointment.deleteMany({});
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} appointments from MongoDB`);

    // 2️⃣ Re-pull everything from GHL
    const result = await syncFromGHL(calendarId);
    if (result.error) {
      return res.status(502).json({ error: "GHL sync failed after clearing", details: result.error });
    }

    return res.status(200).json({
      message: `✅ Cleared ${deleteResult.deletedCount} old records and synced ${result.events.length} appointments from GHL.`,
      deleted: deleteResult.deletedCount,
      synced: result.events.length,
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error("clearAndResync error:", error.message);
      return res.status(400).json({ error: error.message });
    }
    return res.status(400).json({ error: "Unknown error occurred" });
  }
};

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
    const appointment = await Appointment.findOneAndDelete({ ghlAppointmentId: appointmentId as string }).exec();
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

// ============================================
// ✅ CONFIRM APPOINTMENT — create client account + send credentials via email
// POST /appointments/:appointmentId/confirm
// ============================================
export const confirmAppointment = async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;

    // 1️⃣ Find the appointment in MongoDB
    const appointment = await Appointment.findOne({ ghlAppointmentId: appointmentId as string }).exec();
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found in database" });
    }

    const email = appointment.email;
    if (!email) {
      return res.status(400).json({
        error: "Cannot confirm",
        message: "This appointment has no email address associated with it.",
      });
    }

    // 2️⃣ Check if a client with this email already exists
    const existingClient = await Client.findOne({ email }).exec();
    if (existingClient) {
      return res.status(409).json({
        error: "Client already exists",
        message: `A client account for ${email} already exists.`,
      });
    }

    // 3️⃣ Generate a random secure password
    const rawPassword = generateRandomPassword();
    // ✅ Hash explicitly here — NO pre-save hook on Client model.
    // rawPassword is kept in memory to return in the response (never stored).
    // hashedPassword is what gets written to the DB.
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // 4️⃣ Parse name from appointment
    const fullName  = appointment.name || email;
    const nameParts = fullName.trim().split(" ");
    const firstName = nameParts[0] || "Client";
    const lastName  = nameParts.slice(1).join(" ") || "";

    // 5️⃣ Create the client account
    const newClient = await Client.create({
      firstName,
      lastName,
      email,
      contactNumber: appointment.phone || "N/A",
      password: hashedPassword, // already hashed — safe to store
      isArchived: false,
    });

    // 6️⃣ Send credentials via Gmail
    let emailSent = false;
    let emailErrorMsg = "";
    try {
      const gmailTransporter = await createGmailTransporter();
      await gmailTransporter.sendMail({
        from: `"Client Portal" <${FROM_EMAIL}>`,
        to: email,
        subject: "Your Client Portal Account Credentials",
        html: `
        <!DOCTYPE html>
        <html>
          <body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
              <tr>
                <td align="center">
                  <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <tr>
                      <td style="background:#800000;padding:36px 40px;text-align:center;">
                        <!-- ✅ FIX: use table layout to properly center the checkmark circle -->
                        <table cellpadding="0" cellspacing="0" style="margin:0 auto 16px auto;">
                          <tr>
                            <td width="48" height="48" style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:50%;text-align:center;vertical-align:middle;">
                              <span style="color:white;font-size:22px;line-height:48px;">✓</span>
                            </td>
                          </tr>
                        </table>
                        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Client Account Created</h1>
                        <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Your appointment has been confirmed</p>
                      </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                      <td style="padding:36px 40px;">
                        <p style="margin:0 0 20px;color:#374151;font-size:15px;">
                          Hi <strong>${fullName}</strong>, your client portal account has been created. Use the credentials below to log in.
                        </p>

                        <!-- Credentials box -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;padding:24px;margin-bottom:24px;">
                          <tr>
                            <td style="padding-bottom:16px;">
                              <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">Email</p>
                              <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${email}</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="border-top:1px solid #e5e7eb;padding-top:16px;">
                              <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;">Temporary Password</p>
                              <p style="margin:0;font-size:22px;font-weight:700;color:#800000;font-family:monospace;letter-spacing:0.15em;">${rawPassword}</p>
                            </td>
                          </tr>
                        </table>

                        <!-- ✅ FIX: button URL points to /client/login -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                          <tr>
                            <td align="center">
                              <a href="${CLIENT_PORTAL_URL}/client/login" style="display:inline-block;background:#800000;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;">
                                Login to Client Portal
                              </a>
                            </td>
                          </tr>
                        </table>

                        <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                          Please save these credentials. For security, we recommend changing your password after your first login.
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #f3f4f6;">
                        <p style="margin:0;font-size:11px;color:#9ca3af;">This is an automated message. Please do not reply to this email.</p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
      });
      emailSent = true;
      console.log(`📧 Credentials email sent to ${email}`);
    } catch (emailErr) {
      // Still return success — client account was created, only email failed
      emailErrorMsg = emailErr instanceof Error ? emailErr.message : "Unknown email error";
      console.error("Gmail send error:", emailErrorMsg);
    }

    // 7️⃣ Return generated credentials
    return res.status(201).json({
      message: emailSent
        ? `✅ Client account created for ${email}. Credentials sent via email.`
        : `✅ Client account created for ${email}. Warning: email could not be sent.`,
      clientId: newClient._id,
      emailSent,
      ...(emailErrorMsg && { emailError: emailErrorMsg }),
      credentials: {
        email,
        password: rawPassword,
        name: fullName,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error("confirmAppointment error:", error.message);
      return res.status(400).json({ error: error.message });
    }
    return res.status(400).json({ error: "Unknown error occurred" });
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generates a random 12-character alphanumeric password */
function generateRandomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}