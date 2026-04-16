import mongoose from "mongoose";

const { Schema, model } = mongoose;

const sitePageViewSchema = new Schema(
  {
    path: { type: String, required: true, index: true },
    referrer: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    sessionId: { type: String, required: true, index: true },
    kind: {
      type: String,
      enum: ["page", "funnel"],
      default: "page",
      index: true,
    },
    /** Optional display name for GHL / external funnel URLs (set from marketing site on click). */
    funnelLabel: { type: String, default: "" },
    /** Optional email if the visitor is known or has submitted a form in this session */
    email: { type: String, default: "" },
    visitedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

sitePageViewSchema.index({ visitedAt: -1, path: 1 });
sitePageViewSchema.index({ visitedAt: -1, kind: 1 });

const SitePageView =
  mongoose.models.SitePageView || model("SitePageView", sitePageViewSchema);

export default SitePageView;
