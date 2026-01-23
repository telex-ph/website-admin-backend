import mongoose from "mongoose";
const { Schema, model } = mongoose;

const blogSchema = new Schema(
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
    category: {
      type: String,
      enum: ["categor1", "categor2", "categor3"],
      required: true,
    },
    cover: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);
const Blog = model("Blog", blogSchema);
export default Blog;
