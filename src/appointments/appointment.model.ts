import mongoose, { Document, Schema } from "mongoose";

export interface IAppointment extends Document {
  ghlAppointmentId: string;
  calendarId: string;
  locationId: string;
  contactId: string | undefined;
  name: string | undefined;
  email: string | undefined;
  phone: string | undefined;
  title: string | undefined;
  startTime: Date;
  endTime: Date | undefined;
  appointmentStatus: string;
  assignedUserId: string | undefined;
  address: string | undefined;
  // ✅ New fields from GHL appointment details
  assignedUserName: string | undefined;
  calendarName: string | undefined;
  location: string | undefined;
  attendees: string[] | undefined;
  bookedBy: string | undefined;
  source: string | undefined;
  description: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    ghlAppointmentId: { type: String, required: true, unique: true },
    calendarId:       { type: String, required: true },
    locationId:       { type: String, required: true },
    contactId:        { type: String },
    name:             { type: String },
    email:            { type: String },
    phone:            { type: String },
    title:            { type: String },
    startTime:        { type: Date, required: true },
    endTime:          { type: Date },
    appointmentStatus:{ type: String, default: "confirmed" },
    assignedUserId:   { type: String },
    address:          { type: String },
    // ✅ New fields
    assignedUserName: { type: String },
    calendarName:     { type: String },
    location:         { type: String },
    attendees:        { type: [String] },
    bookedBy:         { type: String },
    source:           { type: String },
    description:      { type: String },
  },
  { timestamps: true }
);

const Appointment = mongoose.model<IAppointment>("Appointment", AppointmentSchema);
export default Appointment;