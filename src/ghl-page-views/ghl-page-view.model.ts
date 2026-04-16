import mongoose from "mongoose";

const { Schema, model } = mongoose;

const ghlPageViewSchema = new Schema(
  {
    contactId: { type: String, required: true, index: true },
    contactName: { type: String, default: "Unknown" },
    contactEmail: { type: String, default: "" },
    pageVisited: { type: String, default: "" },
    funnelName: { type: String, default: "" },
    pageUrl: { type: String, default: "" },
    utmSource: { type: String, default: "" },
    viewedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

ghlPageViewSchema.index({ viewedAt: -1 });
ghlPageViewSchema.index({ pageVisited: 1 });

const GhlPageView =
  mongoose.models.GhlPageView || model("GhlPageView", ghlPageViewSchema);

export default GhlPageView;
