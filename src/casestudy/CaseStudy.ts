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

// Sub-schema for likes tracking
const likeSchema = new Schema(
  {
    ipAddress: { type: String, required: false },
    userId: { type: String, required: false },
    likedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const caseStudySchema = new Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, required: false },
    slug: { type: String, required: true, unique: true },
    cover: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "completed", "draft", "scheduled"],
      required: true,
    },
    // UPDATED: Multiple tags support - can be empty array or have multiple values
    tags: {
      type: [String],
      enum: ["technology", "logistics", "analytics", "infrastructure"],
      default: [],
      validate: {
        validator: function (v: string[]) {
          // Allow empty array or array with valid tags
          return Array.isArray(v) && v.every(tag => 
            ["technology", "logistics", "analytics", "infrastructure"].includes(tag)
          );
        },
        message: "Tags must be one or more of: technology, logistics, analytics, infrastructure",
      },
    },
    
    // Author as a simple string field - user types the author name
    author: {
      type: String,
      required: true,
    },
    
    // Date fields
    startDate: { type: Date, required: false },
    endDate: { type: Date, required: false },
    isUnfinished: { type: Boolean, default: false },
    scheduleDate: { type: Date, required: false },
    scheduleTime: { type: String, required: false },
    
    // Content sections - exactly 5 sections with subtitle and text
    // Content sections - Check status context inside controller, 
    // but here we allow flexibility for Drafts
    sections: {
      type: [contentSectionSchema],
      required: true,
      validate: {
        validator: function (v: any[]) {
          // Validation logic handled strictly in Controller depending on status.
          // Here we just ensure it's not empty.
          return v && v.length > 0;
        },
        message: "At least one content section is required",
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

    // NEW: Likes tracking - stores IP addresses or user IDs who liked this case study
    likes: {
      type: [likeSchema],
      default: [],
    },

    // NEW: Total likes count (virtual or computed field for quick access)
    likesCount: {
      type: Number,
      default: 0,
    },

    // Archive flag - soft delete mechanism
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const CaseStudy = model("CaseStudy", caseStudySchema);
export default CaseStudy;