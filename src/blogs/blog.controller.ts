import type { Request, Response } from "express";
import Blog from "./Blog.ts";
import { createBlogSchema, type CreateBlogDto } from "./dto/create-blog.dto.ts";
import { toSlug } from "../common/utils/to-slug.util.ts";
import {
  getParamSchema,
  type GetParamDto,
} from "../common/dto/get-param.dto.ts";
import { updateBlogSchema, type UpdateBlogDto } from "./dto/update-blog.dto.ts";
import { Types } from "mongoose";
import uploadFile from "../common/utils/upload-file.util.ts";
import { trackView } from "../common/services/analytics.service.ts";
import { logActivity, getUserEmailFromRequest } from "../common/services/activity-log.service.ts";

// Adding blog
export const addBlog = async (req: Request, res: Response) => {
  // Check the body using Zod/validation
  const parsed = createBlogSchema.safeParse(req.body);

  // Validate
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body does not match the expected schema",
      details: parsed.error.issues,
    });
  }

  const blog: CreateBlogDto = parsed.data;

  try {
    // File uploading
    const file = req.file;
    if (!file?.buffer) throw new Error("File buffer is empty");
    const url = await uploadFile(file);

    // Create blog object
    const newBlog = await Blog.create({
      title: blog.title,
      slug: toSlug(blog.title),
      content: blog.content,
      category: blog.category,
      author: Types.ObjectId.createFromHexString(blog.author),
      status: blog.status,
      cover: url,
    });

    // 🔴 LOG ACTIVITY - Blog Created
    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "CREATED",
      module: "BLOGS",
      admin: adminEmail,
      details: {
        blogId: newBlog._id.toString(),
        title: newBlog.title,
        slug: newBlog.slug,
        status: newBlog.status,
        category: newBlog.category,
        author: newBlog.author.toString(),
      },
      req,
    });

    res.status(201).json(newBlog);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Adding blog error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Blog error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Fetching all blogs with filtering and search
export const getAllBlogs = async (req: Request, res: Response) => {
  try {
    // Extract query parameters for filtering
    const { search, category, status, author, sortBy, order } = req.query;

    // Build dynamic filter object
    const filter: any = {};

    // Search in title and content
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by category
    if (category) {
      filter.category = category;
    }

    // Filter by status
    if (status) {
      filter.status = status;
    }

    // Filter by author
    if (author) {
      filter.author = author;
    }

    // Build sort object
    const sort: any = {};
    if (sortBy) {
      sort[sortBy as string] = order === "desc" ? -1 : 1;
    } else {
      sort.createdAt = -1; // Default sort by newest
    }

    const blogs = await Blog.find(filter)
      .sort(sort)
      .populate("author", "name email")
      .exec();

    res.status(200).json(blogs);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching blogs error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Blogs error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Fetching single blog by ID with view tracking
export const getBlog = async (req: Request, res: Response) => {
  // Check the params using Zod/validation
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    const blog = await Blog.findById(param.id)
      .populate("author", "name email")
      .exec();

    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    // Track view in background (don't wait for it)
    trackView({
      resourceType: "blog",
      resourceId: param.id,
      req,
    }).catch((err) => console.error("View tracking error:", err));

    res.status(200).json(blog);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching blog error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Blog error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Fetching single blog by slug with view tracking
export const getBlogBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        error: "Validation failed",
        message: "Slug parameter is required",
      });
    }

    const blog = await Blog.findOne({ slug })
      .populate("author", "name email")
      .exec();

    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    // Track view in background (don't wait for it)
    trackView({
      resourceType: "blog",
      resourceId: blog._id.toString(),
      req,
    }).catch((err) => console.error("View tracking error:", err));

    res.status(200).json(blog);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching blog by slug error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Blog error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Updating blog
export const updateBlog = async (req: Request, res: Response) => {
  // Validate the params
  const parsedParams = getParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  // Validate the body
  const parsedBody = updateBlogSchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body does not match the expected schema",
      details: parsedBody.error.issues,
    });
  }

  const param: GetParamDto = parsedParams.data;
  const body: UpdateBlogDto = parsedBody.data;

  try {
    // Get existing blog for activity log
    const existingBlog = await Blog.findById(param.id).exec();
    if (!existingBlog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    // Store old data for activity log
    const oldData = {
      title: existingBlog.title,
      slug: existingBlog.slug,
      status: existingBlog.status,
      category: existingBlog.category,
    };

    // If title is being updated, regenerate slug
    const updateData = body.title
      ? { ...body, slug: toSlug(body.title) }
      : body;

    // Search for the id and update
    const blog = await Blog.findByIdAndUpdate(param.id, updateData, {
      new: true,
      runValidators: true,
    }).exec();

    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    // 🔴 LOG ACTIVITY - Blog Updated
    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "UPDATED",
      module: "BLOGS",
      admin: adminEmail,
      details: {
        blogId: blog._id.toString(),
        oldData,
        newData: {
          title: blog.title,
          slug: blog.slug,
          status: blog.status,
          category: blog.category,
        },
        fieldsUpdated: Object.keys(body),
      },
      req,
    });

    res.status(200).json(blog);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Updating blog error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Blog error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Deleting blog
export const deleteBlog = async (req: Request, res: Response) => {
  // Check the params using Zod/validation
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    // Get existing blog for activity log before deletion
    const existingBlog = await Blog.findById(param.id).exec();
    if (!existingBlog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    // Store data before deletion for activity log
    const deletedData = {
      blogId: existingBlog._id.toString(),
      title: existingBlog.title,
      slug: existingBlog.slug,
      status: existingBlog.status,
      category: existingBlog.category,
      author: existingBlog.author.toString(),
    };

    // Search for the id and delete
    const blog = await Blog.findByIdAndDelete(param.id).exec();

    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    // 🔴 LOG ACTIVITY - Blog Deleted
    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "DELETED",
      module: "BLOGS",
      admin: adminEmail,
      details: deletedData,
      req,
    });

    res
      .status(200)
      .json({ message: "Blog deleted successfully", data: blog });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Deleting blog error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Blog error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};