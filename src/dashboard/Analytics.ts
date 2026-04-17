import mongoose from "mongoose";
const { Schema, model } = mongoose;

// Sub-schema for individual view records
const viewSchema = new Schema(
  {
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    userId: { type: String, required: false },
  },
  { _id: false }
);

// Sub-schema for daily view counts
const dailyViewSchema = new Schema(
  {
    date: { type: Date, required: true },
    count: { type: Number, default: 0 },
  },
  { _id: false }
);

// Main Analytics Schema
const analyticsSchema = new Schema(
  {
    resourceType: {
      type: String,
      enum: ["blog", "casestudy"],
      required: true,
      index: true,
    },
    resourceId: {
      type: String,
      required: true,
      index: true,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    uniqueViewCount: {
      type: Number,
      default: 0,
    },
    views: {
      type: [viewSchema],
      default: [],
    },
    dailyViews: {
      type: [dailyViewSchema],
      default: [],
    },
    lastViewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for faster queries
analyticsSchema.index({ resourceType: 1, resourceId: 1 }, { unique: true });

// Index for date-based queries
analyticsSchema.index({ "dailyViews.date": 1 });

const Analytics = model("Analytics", analyticsSchema);
export default Analytics;
