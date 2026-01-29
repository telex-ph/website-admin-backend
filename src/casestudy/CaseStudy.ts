import mongoose from "mongoose";
const { Schema, model } = mongoose;

// Sub-schema for content sections (subtitle/text pairs)
const contentSectionSchema = new Schema(
  {
    subtitle: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

// Sub-schema for challenge/solution items
const challengeSolutionSchema = new Schema(
  {
    title: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const caseStudySchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    cover: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "completed", "draft", "scheduled"],
      required: true,
    },
    tags: {
      type: [String],
      enum: ["technology", "logistics", "analytics", "infrastructure"],
      default: [],
    },
    
    // Author reference to User model
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    // Content sections - exactly 5 sections with subtitle and text
    sections: {
      type: [contentSectionSchema],
      required: true,
      validate: {
        validator: function (v: any[]) {
          return v && v.length === 5;
        },
        message: "Exactly 5 content sections are required",
      },
    },
    
    // Challenge - array of objects with title and text
    challenge: {
      type: [challengeSolutionSchema],
      required: true,
      validate: {
        validator: function (v: any[]) {
          return v && v.length > 0;
        },
        message: "At least one challenge is required",
      },
    },
    
    // Solution - array of objects with title and text
    solution: {
      type: [challengeSolutionSchema],
      required: true,
      validate: {
        validator: function (v: any[]) {
          return v && v.length > 0;
        },
        message: "At least one solution is required",
      },
    },
  },
  {
    timestamps: true,
  }
);

const CaseStudy = model("CaseStudy", caseStudySchema);
export default CaseStudy;