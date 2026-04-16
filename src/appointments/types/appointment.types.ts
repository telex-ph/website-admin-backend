export interface GHLSlot {
  startTime: string;
  endTime: string;
}

export interface GHLFreeSlotsResponse {
  _dates_: {
    [date: string]: GHLSlot[];
  };
}

export interface CreateAppointmentBody {
  calendarId?: string;
  locationId?: string;
  contactId?: string;
  startTime: string;
  endTime?: string;
  title?: string;
  appointmentStatus?: string;
  assignedUserId?: string;
  address?: string;
  ignoreDateRange?: boolean;
  toNotify?: boolean;
  // Contact info (if no contactId)
  email?: string;
  phone?: string;
  name?: string;
}

export interface GHLCalendar {
  id: string;
  name: string;
  description?: string;
  locationId: string;
  groupId?: string;
  isActive: boolean;
}
