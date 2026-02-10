import type { Request, Response } from "express";
import Blog, { type IBlog, type IContentSection } from "./Blog.ts";
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

// ============================================
// 📅 AUTO-PUBLISH SCHEDULER
// ============================================
// Helper function to check and auto-publish scheduled blogs
const autoPublishScheduledBlogs = async () => {
  try {
    const now = new Date();
    
    // Find all blogs with status "scheduled" and scheduledDate that has passed
    const scheduledBlogs = await Blog.find({
      status: "scheduled",
      scheduledDate: { $lte: now }
    });

    if (scheduledBlogs.length > 0) {
      console.log(`📅 [AUTO-PUBLISH] Found ${scheduledBlogs.length} scheduled blog(s) ready to publish`);
      
      for (const blog of scheduledBlogs) {
        try {
          // Update status to published
          blog.status = "published";
          await blog.save();
          
          console.log(`✅ [AUTO-PUBLISH] Published: "${blog.title}" (ID: ${blog._id})`);
          console.log(`   - Scheduled Date: ${blog.scheduledDate}`);
          console.log(`   - Published At: ${now}`);
        } catch (error) {
          console.error(`❌ [AUTO-PUBLISH] Error publishing blog ${blog._id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("❌ [AUTO-PUBLISH] Error in autoPublishScheduledBlogs:", error);
  }
};


// Adding blog
export const addBlog = async (req: Request, res: Response) => {
  // --- PRE-VALIDATION LOGIC PARA SA FORMDATA ---
  let bodyToValidate = { ...req.body };

  // 1. FIX: I-parse ang mainContent pabalik sa Array (kasi stringified ito sa FormData)
  if (typeof bodyToValidate.mainContent === 'string') {
    try {
      bodyToValidate.mainContent = JSON.parse(bodyToValidate.mainContent);
    } catch (e) {
      return res.status(400).json({ error: "Invalid format for mainContent" });
    }
  }

  // 2. FIX: I-handle ang empty strings mula sa FormData para sa optional/nullable fields
  if (bodyToValidate.scheduledDate === "" || bodyToValidate.scheduledDate === "null" || bodyToValidate.scheduledDate === "undefined") {
    bodyToValidate.scheduledDate = undefined;
  }

  // Validate the body gamit ang nilinis na data
  const parsedBody = createBlogSchema.safeParse(bodyToValidate);

  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body does not match the expected schema",
      details: parsedBody.error.issues,
    });
  }

  const body: CreateBlogDto = parsedBody.data;

  try {
    // 3. HANDLE IMAGE UPLOAD (required for new blog)
    if (!req.file) {
      return res.status(400).json({ error: "Picture is required" });
    }

    const result = await uploadFile(req.file);
    
    // Handle different return types from uploadFile
    let pictureUrl: string;
    if (typeof result === 'string') {
      pictureUrl = result;
    } else if (result && typeof result === 'object' && 'url' in result) {
      pictureUrl = (result as any).url;
    } else if (result && typeof result === 'object' && 'secure_url' in result) {
      pictureUrl = (result as any).secure_url;
    } else {
      console.error("❌ Upload result is invalid:", result);
      return res.status(400).json({ error: "Failed to upload picture - invalid response" });
    }

    if (!pictureUrl) {
      console.error("❌ Picture URL is empty after upload");
      return res.status(400).json({ error: "Failed to upload picture - no URL returned" });
    }

    console.log("✅ Picture URL obtained:", pictureUrl);

    // Create blog with uploaded picture
    const newBlog: Partial<IBlog> = {
      ...body,
      slug: toSlug(body.title),
      picture: pictureUrl,
      scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
    } as any;

    const blog = await Blog.create(newBlog);

    // 🔴 LOG ACTIVITY - Blog Created
    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "CREATED",
      module: "BLOGS",
      admin: adminEmail,
      details: {
        blogId: blog._id.toString(),
        title: blog.title,
        slug: blog.slug,
        status: blog.status,
        mainCategory: blog.mainCategory,
        subcategory: blog.subcategory,
        author: blog.author,
      },
      req,
    });

    res.status(201).json(blog);
  } catch (error) {
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
    // 📅 AUTO-PUBLISH SCHEDULED BLOGS
    // Check and automatically publish any scheduled blogs that have reached their scheduled date
    await autoPublishScheduledBlogs();

    // Extract query parameters for filtering
    const { search, mainCategory, subcategory, status, author, sortBy, order } = req.query;

    // Build dynamic filter object
    const filter: any = {};

    // Search in title, short description, and main content
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { shortDescription: { $regex: search, $options: "i" } },
        { "mainContent.title": { $regex: search, $options: "i" } },
        { "mainContent.content": { $regex: search, $options: "i" } },
      ];
    }

    // Filter by main category
    if (mainCategory) {
      filter.mainCategory = mainCategory;
    }

    // Filter by subcategory
    if (subcategory) {
      filter.subcategory = subcategory;
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
  // 📅 AUTO-PUBLISH SCHEDULED BLOGS
  await autoPublishScheduledBlogs();

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
    const blog = await Blog.findById(param.id).exec();

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
    // 📅 AUTO-PUBLISH SCHEDULED BLOGS
    await autoPublishScheduledBlogs();

    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({
        error: "Validation failed",
        message: "Slug parameter is required",
      });
    }

    const blog = await Blog.findOne({ slug }).exec();

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
  console.log("📄 ============= UPDATE BLOG STARTED =============");
  console.log("📦 Request body:", JSON.stringify(req.body, null, 2));
  console.log("📎 File attached:", req.file ? `Yes - ${req.file.originalname}` : "No");
  console.log("🆔 Blog ID from params:", req.params.id);
  
  // Validate the params
  const parsedParams = getParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  // --- PRE-VALIDATION LOGIC PARA SA FORMDATA ---
  let bodyToValidate = { ...req.body };

  // 1. FIX: I-parse ang mainContent pabalik sa Array (kasi stringified ito sa FormData)
  if (typeof bodyToValidate.mainContent === 'string') {
    try {
      bodyToValidate.mainContent = JSON.parse(bodyToValidate.mainContent);
    } catch (e) {
      return res.status(400).json({ error: "Invalid format for mainContent" });
    }
  }

  // 2. FIX: I-handle ang empty strings mula sa FormData para sa optional/nullable fields
  if (bodyToValidate.scheduledDate === "" || bodyToValidate.scheduledDate === "null" || bodyToValidate.scheduledDate === "undefined") {
    bodyToValidate.scheduledDate = null;
  }

  // Validate the body gamit ang nilinis na data
  const parsedBody = updateBlogSchema.safeParse(bodyToValidate);

  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body does not match the expected schema",
      details: parsedBody.error.issues,
    });
  }

  const param: GetParamDto = parsedParams.data;
  const body: UpdateBlogDto = parsedBody.data;

  console.log("✅ Validation passed!");
  console.log("📋 Parsed body:", JSON.stringify(body, null, 2));
  console.log("🎯 Target blog ID:", param.id);

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
      mainCategory: existingBlog.mainCategory,
      subcategory: existingBlog.subcategory,
      shortDescription: existingBlog.shortDescription,
      scheduledDate: existingBlog.scheduledDate?.toISOString(),
      picture: existingBlog.picture,
    };

    // 3. HANDLE IMAGE UPLOAD - FIXED LOGIC WITH COMPREHENSIVE ERROR HANDLING
    let pictureUrl = existingBlog.picture; // default sa luma
    let hasPictureUpdate = false;
    
    if (req.file) {
      console.log("📸 ========== FILE UPLOAD DEBUG ==========");
      console.log("📸 File name:", req.file.originalname);
      console.log("📸 File size:", req.file.size, "bytes");
      console.log("📸 File mimetype:", req.file.mimetype);
      console.log("📸 File buffer length:", req.file.buffer?.length || 'N/A');
      console.log("📸 File path:", req.file.path || 'N/A');
      
      try {
        console.log("📸 Calling uploadFile function...");
        const result = await uploadFile(req.file);
        
        console.log("📸 ========== UPLOAD RESULT DEBUG ==========");
        console.log("📸 Result type:", typeof result);
        console.log("📸 Result is null?:", result === null);
        console.log("📸 Result is undefined?:", result === undefined);
        console.log("📸 Result value:", JSON.stringify(result, null, 2));
        
        // Handle different return types from uploadFile
        if (typeof result === 'string') {
          console.log("📸 Result is a string, using directly");
          pictureUrl = result;
        } else if (result && typeof result === 'object') {
          console.log("📸 Result is an object, checking properties...");
          console.log("📸 Available properties:", Object.keys(result));
          
          // Try different possible property names
          pictureUrl = (result as any).url || 
                       (result as any).secure_url || 
                       (result as any).location ||
                       (result as any).path;
          
          console.log("📸 Extracted URL:", pictureUrl);
        } else {
          console.error("❌ Result is neither string nor object");
        }
        
        if (!pictureUrl || pictureUrl === existingBlog.picture) {
          console.error("❌ ========== UPLOAD FAILED ==========");
          console.error("❌ No valid URL returned from upload");
          console.error("❌ pictureUrl value:", pictureUrl);
          console.error("❌ existingBlog.picture:", existingBlog.picture);
          console.error("❌ Full result:", JSON.stringify(result, null, 2));
          return res.status(400).json({ 
            error: "Failed to upload picture - no URL returned",
            debug: { 
              resultType: typeof result, 
              result,
              pictureUrl,
              existingPicture: existingBlog.picture
            }
          });
        }
        
        hasPictureUpdate = true;
        console.log("✅ ========== UPLOAD SUCCESS ==========");
        console.log("✅ Picture uploaded successfully!");
        console.log("✅ New URL:", pictureUrl);
      } catch (uploadError) {
        console.error("❌ ========== UPLOAD ERROR ==========");
        console.error("❌ Upload function threw error:", uploadError);
        console.error("❌ Error message:", uploadError instanceof Error ? uploadError.message : String(uploadError));
        console.error("❌ Error stack:", uploadError instanceof Error ? uploadError.stack : 'N/A');
        return res.status(400).json({ 
          error: "Failed to upload picture", 
          details: uploadError instanceof Error ? uploadError.message : String(uploadError)
        });
      }
    } else {
      console.log("ℹ️  No new file uploaded, keeping existing picture:", existingBlog.picture);
    }

    // Build update data
    const updateData: any = { ...body };
    
    console.log("🔍 ========== UPDATE DATA DEBUG ==========");
    console.log("🔍 Body mainCategory:", body.mainCategory);
    console.log("🔍 Body subcategory:", body.subcategory);
    console.log("🔍 UpdateData mainCategory:", updateData.mainCategory);
    console.log("🔍 UpdateData subcategory:", updateData.subcategory);
    
    // If title is being updated, regenerate slug
    if (body.title) {
      updateData.slug = toSlug(body.title);
    }
    
    // ✅ FIX: Always update picture if there's a new upload
    if (hasPictureUpdate) {
      updateData.picture = pictureUrl;
      console.log("🖼️  ========== PICTURE UPDATE ==========");
      console.log("🖼️  Old picture:", existingBlog.picture);
      console.log("🖼️  New picture:", pictureUrl);
      console.log("🖼️  Pictures are different?:", existingBlog.picture !== pictureUrl);
    } else {
      console.log("🖼️  Picture remains unchanged:", existingBlog.picture);
    }

    console.log("📝 Final update data:", JSON.stringify(updateData, null, 2));

    // Convert scheduledDate string to Date if present, or explicitly set to undefined if null
    if (updateData.scheduledDate !== undefined) {
      if (updateData.scheduledDate === null) {
        // Explicitly remove scheduledDate from the document
        updateData.scheduledDate = undefined;
        console.log("🗑️  Removing scheduledDate (set to undefined)");
      } else {
        // Convert string to Date object
        updateData.scheduledDate = new Date(updateData.scheduledDate);
        console.log("📅 Updated scheduledDate:", updateData.scheduledDate);
      }
    }

    // Search for the id and update
    const blog = await Blog.findByIdAndUpdate(param.id, updateData, {
      new: true,
      runValidators: true,
    }).exec();

    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    console.log("✅ ========== UPDATE COMPLETE ==========");
    console.log("✅ Blog updated successfully!");
    console.log("📊 Final blog state:");
    console.log("   - Title:", blog.title);
    console.log("   - Picture:", blog.picture);
    console.log("   - Status:", blog.status);

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
          mainCategory: blog.mainCategory,
          subcategory: blog.subcategory,
          shortDescription: blog.shortDescription,
          scheduledDate: blog.scheduledDate?.toISOString(),
          picture: blog.picture,
        },
        fieldsUpdated: Object.keys(body),
        pictureUpdated: hasPictureUpdate,
      },
      req,
    });

    res.status(200).json(blog);
  } catch (error) {
    if (error instanceof Error) {
      console.error("❌ Updating blog error:", error.message);
      console.error("❌ Stack trace:", error.stack);
      res.status(400).json({ error: error.message });
    } else {
      console.error("❌ Blog error:", error);
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
      mainCategory: existingBlog.mainCategory,
      subcategory: existingBlog.subcategory,
      author: existingBlog.author.toString(),
      scheduledDate: existingBlog.scheduledDate?.toISOString(),
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