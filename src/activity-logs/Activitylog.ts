import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

export interface IActivityLog {
  action: "CREATED" | "UPDATED" | "DELETED" | "ARCHIVED" | "RESTORED" | "LOGIN" | "LOGOUT";
  module: "CASESTUDY" | "BLOGS" | "ACCOUNT_SETTINGS" | "AUTH" | "SERVICES";
  admin: string;
  description: string;
  details: any;
  readBy: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
  deletedAt: Date | null;
  loggedInAt: Date | null;
  loggedOutAt: Date | null;
  restoredAt: Date | null;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    action: {
      type: String,
      enum: ["CREATED", "UPDATED", "DELETED", "ARCHIVED", "RESTORED", "LOGIN", "LOGOUT"],
      required: true,
    },
    module: {
      type: String,
      enum: ["CASESTUDY", "BLOGS", "ACCOUNT_SETTINGS", "AUTH", "SERVICES"],
      required: true,
    },
    admin: {
      type: String, // Email of the admin who performed the action
      required: true,
    },
    // Human-readable description of the action performed
    // e.g., "Updated title of 'My Blog Post' from 'Old Title' to 'New Title'"
    description: {
      type: String,
      default: "",
    },
    details: {
      // Can store any object structure.
      // Convention:
      //   CREATED / DELETED  → { title: string }
      //   UPDATED            → { title: string, changes: [{ field, label, oldValue, newValue }] }
      //   ACCOUNT_SETTINGS   → { name: string, email: string, changes?: [...] }
      //   RESTORED           → { title: string }
      type: Schema.Types.Mixed,
      default: {},
    },
    // Array of admin emails who have read this log
    readBy: {
      type: [String],
      default: [],
    },
    // Timestamp fields - only one will be filled based on action
    createdAt: {
      type: Date,
      default: null,
    },
    updatedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    loggedInAt: {
      type: Date,
      default: null,
    },
    loggedOutAt: {
      type: Date,
      default: null,
    },
    restoredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false, // Disable automatic timestamps since we're managing them manually
  }
);

// Check if model already exists before compiling
const ActivityLog =
  (models.ActivityLog as mongoose.Model<IActivityLog>) ||
  model<IActivityLog>("ActivityLog", activityLogSchema);

export default ActivityLog;