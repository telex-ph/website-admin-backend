import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const activityLogSchema = new Schema(
  {
    action: {
      type: String,
      enum: ["CREATED", "UPDATED", "DELETED", "LOGIN", "LOGOUT"],
      required: true,
    },
    module: {
      type: String,
      enum: ["CASESTUDY", "BLOGS", "ACCOUNT_SETTINGS", "AUTH"],
      required: true,
    },
    admin: {
      type: String, // Email of the admin who performed the action
      required: true,
    },
    details: {
      type: Schema.Types.Mixed, // Can store any object structure
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
  },
  {
    timestamps: false, // Disable automatic timestamps since we're managing them manually
  }
);

// Check if model already exists before compiling
const ActivityLog = models.ActivityLog || model("ActivityLog", activityLogSchema);
export default ActivityLog;