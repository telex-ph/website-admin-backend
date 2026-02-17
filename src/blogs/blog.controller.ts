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
// 📋 ACTIVITY LOG HELPERS
// ============================================
const BLOG_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  status: "Status",
  mainCategory: "Main Category",
  subcategory: "Subcategory",
  shortDescription: "Short Description",
  scheduledDate: "Scheduled Date",
  picture: "Cover Image",
  author: "Author",
};

const buildBlogChanges = (
  oldData: Record<string, any>,
  newData: Record<string, any>,
  fieldsUpdated: string[]
) => {
  const changes: { field: string; label: string; oldValue: any; newValue: any }[] = [];

  for (const field of fieldsUpdated) {
    if (!(field in BLOG_FIELD_LABELS)) continue;
    const oldVal = oldData[field] ?? null;
    const newVal = newData[field] ?? null;
    // Only include if value actually changed
    if (String(oldVal) === String(newVal)) continue;
    changes.push({
      field,
      label: BLOG_FIELD_LABELS[field],
      oldValue: oldVal,
      newValue: newVal,
    });
  }

  return changes;
};

// ============================================
// 🆕 HELPER: GET USER IDENTIFIER FOR LIKES
// ============================================
const getUserIdentifier = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded 
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0])
    : req.socket.remoteAddress || 'unknown';
  
  return ip;
};

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
      likeCount: 0,
      likedBy: [],
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
        description: `Created blog post "${blog.title}"`,
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
  console.log("\n📖 ===== GET BLOG =====");
  
  // 📅 AUTO-PUBLISH SCHEDULED BLOGS
  await autoPublishScheduledBlogs();

  // Check the params using Zod/validation
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    console.error("❌ Validation failed:", parsed.error);
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;
  console.log("📋 Fetching blog with ID:", param.id);

  try {
    // Search for the id
    const blog = await Blog.findById(param.id).exec();

    if (!blog) {
      console.error("❌ Blog not found with ID:", param.id);
      return res.status(404).json({ error: "Blog not found" });
    }

    console.log("✅ Found blog:", blog.title);

    // 👁️ Track view - UPDATED TO USE CORRECT SIGNATURE
    try {
      await trackView({
        resourceType: 'blog',
        resourceId: blog._id.toString(),
        req,
      });
      console.log("✅ View tracked successfully");
    } catch (viewError) {
      console.error("⚠️ Error tracking view (non-critical):", viewError instanceof Error ? viewError.message : viewError);
      // Don't fail the request if view tracking fails
    }

    console.log("🎉 ===== END GET BLOG =====\n");

    res.status(200).json(blog);
  } catch (error) {
    console.error("❌ GET BLOG ERROR:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Unknown error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Fetching blog by slug with view tracking
export const getBlogBySlug = async (req: Request, res: Response) => {
  console.log("\n🔍 ===== FETCH BLOG BY SLUG =====");
  
  // 📅 AUTO-PUBLISH SCHEDULED BLOGS
  await autoPublishScheduledBlogs();

  try {
    const { slug } = req.params;
    console.log("📋 Fetching blog with slug:", slug);

    if (!slug) {
      return res.status(400).json({ error: "Slug parameter is required" });
    }

    // Search for blog by slug
    const blog = await Blog.findOne({ slug }).exec();

    if (!blog) {
      console.error("❌ Blog not found with slug:", slug);
      return res.status(404).json({ error: "Blog not found" });
    }

    console.log("✅ Found blog:", blog.title);

    // 👁️ Track view - UPDATED TO USE CORRECT SIGNATURE
    try {
      await trackView({
        resourceType: 'blog',
        resourceId: blog._id.toString(),
        req,
      });
      console.log("✅ View tracked successfully");
    } catch (viewError) {
      console.error("⚠️ Error tracking view (non-critical):", viewError instanceof Error ? viewError.message : viewError);
      // Don't fail the request if view tracking fails
    }

    console.log("🎉 ===== END FETCH BLOG BY SLUG =====\n");

    res.status(200).json(blog);
  } catch (error) {
    console.error("❌ FETCH BY SLUG ERROR:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Unknown error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Updating blog
export const updateBlog = async (req: Request, res: Response) => {
  console.log("🔄 ========== UPDATE BLOG REQUEST ==========");
  console.log("📥 Request body:", JSON.stringify(req.body, null, 2));
  console.log("📁 Has file?:", !!req.file);
  if (req.file) {
    console.log("📸 File details:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  }

  // --- PRE-VALIDATION LOGIC PARA SA FORMDATA ---
  let bodyToValidate = { ...req.body };

  console.log("🔍 RAW body before parsing:", bodyToValidate);

  // 1. FIX: I-parse ang mainContent pabalik sa Array (kasi stringified ito sa FormData)
  if (typeof bodyToValidate.mainContent === 'string') {
    try {
      bodyToValidate.mainContent = JSON.parse(bodyToValidate.mainContent);
      console.log("✅ Parsed mainContent:", bodyToValidate.mainContent);
    } catch (e) {
      return res.status(400).json({ error: "Invalid format for mainContent" });
    }
  }

  // 2. FIX: I-handle ang empty strings mula sa FormData para sa optional/nullable fields
  // ⚠️ IMPORTANT: Explicitly handle scheduled date removal
  if (bodyToValidate.scheduledDate === "" || bodyToValidate.scheduledDate === "null" || bodyToValidate.scheduledDate === "undefined") {
    bodyToValidate.scheduledDate = null; // Explicitly set to null to trigger removal
    console.log("🗑️  ScheduledDate set to null (will be removed)");
  }

  console.log("🔍 Body after preprocessing:", JSON.stringify(bodyToValidate, null, 2));

  // Validate the body gamit ang nilinis na data
  const parsedBody = updateBlogSchema.safeParse(bodyToValidate);

  if (!parsedBody.success) {
    console.error("❌ Validation failed:", parsedBody.error);
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body does not match the expected schema",
      details: parsedBody.error.issues,
    });
  }

  const body: UpdateBlogDto = parsedBody.data;
  console.log("✅ Validated body:", JSON.stringify(body, null, 2));

  // Check the params using Zod/validation
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;
  console.log("📋 Updating blog with ID:", param.id);

  try {
    // Get existing blog FIRST para ma-compare natin ang data
    const existingBlog = await Blog.findById(param.id).exec();
    if (!existingBlog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    console.log("📖 Existing blog state:");
    console.log("   - Title:", existingBlog.title);
    console.log("   - Picture:", existingBlog.picture);
    console.log("   - Status:", existingBlog.status);
    console.log("   - ScheduledDate:", existingBlog.scheduledDate);

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

    // 3. HANDLE IMAGE UPLOAD (optional for update)
    let pictureUrl: string | undefined;
    let hasPictureUpdate = false;

    if (req.file) {
      console.log("🖼️  New file detected, uploading...");
      const result = await uploadFile(req.file);
      
      // Handle different return types from uploadFile
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

      console.log("✅ New picture URL obtained:", pictureUrl);
      hasPictureUpdate = true;
    }

    // Build update object
    const updateData: Partial<IBlog> = {} as any;

    // Only add fields that are provided in the request
    if (body.title !== undefined) updateData.title = body.title;
    if (body.author !== undefined) updateData.author = body.author;
    if (body.mainCategory !== undefined) updateData.mainCategory = body.mainCategory;
    if (body.subcategory !== undefined) updateData.subcategory = body.subcategory;
    if (body.shortDescription !== undefined) updateData.shortDescription = body.shortDescription;
    if (body.mainContent !== undefined) updateData.mainContent = body.mainContent;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.scheduledDate !== undefined) updateData.scheduledDate = body.scheduledDate as any;

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
    const newData = {
      title: blog.title,
      slug: blog.slug,
      status: blog.status,
      mainCategory: blog.mainCategory,
      subcategory: blog.subcategory,
      shortDescription: blog.shortDescription,
      scheduledDate: blog.scheduledDate?.toISOString(),
      picture: blog.picture,
    };
    const changes = buildBlogChanges(oldData, newData, Object.keys(body));
    if (hasPictureUpdate) {
      changes.push({
        field: "picture",
        label: "Cover Image",
        oldValue: oldData.picture,
        newValue: newData.picture,
      });
    }
    const changedLabels = changes.map((c) => c.label).join(", ");
    await logActivity({
      action: "UPDATED",
      module: "BLOGS",
      admin: adminEmail,
      details: {
        blogId: blog._id.toString(),
        title: blog.title,
        oldData,
        newData,
        fieldsUpdated: Object.keys(body),
        pictureUpdated: hasPictureUpdate,
        changes,
        description: `Updated blog post "${blog.title}"${changedLabels ? ` — changed: ${changedLabels}` : ""}`,
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
      details: {
        ...deletedData,
        description: `Deleted blog post "${deletedData.title}"`,
      },
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

// ============================================
// 🆕 LIKE/UNLIKE FUNCTIONALITY
// ============================================

// Like a blog
export const likeBlog = async (req: Request, res: Response) => {
  try {
    const blogId = req.params.id;
    const userIdentifier = getUserIdentifier(req);

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Check if user already liked this blog
    if (blog.likedBy.includes(userIdentifier)) {
      return res.status(400).json({ 
        message: "You have already liked this blog",
        likeCount: blog.likeCount,
        hasLiked: true
      });
    }

    // Add like
    blog.likeCount += 1;
    blog.likedBy.push(userIdentifier);
    await blog.save();

    res.status(200).json({ 
      message: "Blog liked successfully",
      likeCount: blog.likeCount,
      hasLiked: true
    });
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Unlike a blog
export const unlikeBlog = async (req: Request, res: Response) => {
  try {
    const blogId = req.params.id;
    const userIdentifier = getUserIdentifier(req);

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Check if user has liked this blog
    if (!blog.likedBy.includes(userIdentifier)) {
      return res.status(400).json({ 
        message: "You haven't liked this blog yet",
        likeCount: blog.likeCount,
        hasLiked: false
      });
    }

    // Remove like
    blog.likeCount -= 1;
    blog.likedBy = blog.likedBy.filter(id => id !== userIdentifier);
    await blog.save();

    res.status(200).json({ 
      message: "Blog unliked successfully",
      likeCount: blog.likeCount,
      hasLiked: false
    });
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Check if user has liked a blog
export const checkLikeStatus = async (req: Request, res: Response) => {
  try {
    const blogId = req.params.id;
    const userIdentifier = getUserIdentifier(req);

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    const hasLiked = blog.likedBy.includes(userIdentifier);

    res.status(200).json({ 
      hasLiked,
      likeCount: blog.likeCount
    });
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};