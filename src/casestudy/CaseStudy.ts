import mongoose from "mongoose";
const { Schema, model } = mongoose;

const caseStudySchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true },
    status: {
      type: String,
      enum: ["published", "draft", "scheduled"],
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    content: { type: String, required: true },
    client: { type: String, required: true },
    industry: { type: String, required: true },
    challenge: { type: String, required: true },
    solution: { type: String, required: true },
    results: { type: String, required: true },
    cover: { type: String, required: true },
    // NEW FIELDS - Add your custom fields here
    tags: { type: [String], default: [] }, // Array of strings
    featured: { type: Boolean, default: false }, // Boolean
    projectDate: { type: Date }, // Date (optional)
    testimonial: { type: String }, // String (optional)
  },
  {
    timestamps: true,
  }
);

const CaseStudy = model("CaseStudy", caseStudySchema);
export default CaseStudy;