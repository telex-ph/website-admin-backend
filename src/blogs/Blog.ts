import mongoose from "mongoose";
const { Schema, model } = mongoose;

const blogSchema = new Schema(
  {
    title: String,
    slug: String,
    status: String,
    author: String,
    content: String,
    category: String,
  },
  {
    timestamps: true,
  },
);
const Blog = model("Blog", blogSchema);
export default Blog;
