import mongoose from "mongoose";
const { Schema, model } = mongoose;

const analyticsSchema = new Schema(
  {
    resourceType: {
      type: String,
      enum: ["blog", "casestudy"],
      required: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      // Remove refPath since we'll handle it differently
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    uniqueViewCount: {
      type: Number,
      default: 0,
    },
    // Track individual views with timestamps
    views: [
      {
        ipAddress: { type: String },
        userAgent: { type: String },
        timestamp: { type: Date, default: Date.now },
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
      },
    ],
    // Track daily views for trend analysis
    dailyViews: [
      {
        date: { type: Date, required: true },
        count: { type: Number, default: 0 },
      },
    ],
    lastViewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index for efficient queries
analyticsSchema.index({ resourceType: 1, resourceId: 1 }, { unique: true });
analyticsSchema.index({ "dailyViews.date": 1 });

// Virtual field to get the referenced resource
// We need to handle this manually in the controller since model names don't match resourceType values
analyticsSchema.virtual("resource", {
  ref: function (this: any) {
    // Map resourceType to actual model name
    return this.resourceType === "blog" ? "Blog" : "CaseStudy";
  },
  localField: "resourceId",
  foreignField: "_id",
  justOne: true,
});

const Analytics = model("Analytics", analyticsSchema);
export default Analytics;