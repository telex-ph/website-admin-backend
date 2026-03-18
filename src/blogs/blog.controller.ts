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
import { logActivity, getUserEmailFromRequest, type ActivityAction } from "../common/services/activity-log.service.ts";
import mongoose from "mongoose";

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
    if (String(oldVal) === String(newVal)) continue;
    changes.push({
      field,
      label: BLOG_FIELD_LABELS[field]!,
      oldValue: oldVal,
      newValue: newVal,
    });
  }

  return changes;
};

const getUserIdentifier = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? (forwarded.split(',')[0] ?? 'unknown') : (forwarded[0] ?? 'unknown'))
    : req.socket.remoteAddress || 'unknown';
  return ip;
};

const autoPublishScheduledBlogs = async () => {
  try {
    const now = new Date();
    const scheduledBlogs = await Blog.find({
      status: "scheduled",
      scheduledDate: { $lte: now }
    });

    if (scheduledBlogs.length > 0) {
      console.log(`📅 [AUTO-PUBLISH] Found ${scheduledBlogs.length} scheduled blog(s) ready to publish`);
      for (const blog of scheduledBlogs) {
        try {
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


// ============================================
// ➕ ADD BLOG (Admin Panel - with file upload)
// ============================================
export const addBlog = async (req: Request, res: Response) => {
  let bodyToValidate = { ...req.body };

  if (typeof bodyToValidate.mainContent === 'string') {
    try {
      bodyToValidate.mainContent = JSON.parse(bodyToValidate.mainContent);
    } catch (e) {
      return res.status(400).json({ error: "Invalid format for mainContent" });
    }
  }

  if (bodyToValidate.scheduledDate === "" || bodyToValidate.scheduledDate === "null" || bodyToValidate.scheduledDate === "undefined") {
    bodyToValidate.scheduledDate = undefined;
  }

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
    if (!req.file) {
      return res.status(400).json({ error: "Picture is required" });
    }

    const result = await uploadFile(req.file);

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

    const newBlog: Partial<IBlog> = {
      ...body,
      slug: toSlug(body.title),
      picture: pictureUrl,
      scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
      likeCount: 0,
      likedBy: [],
      isArchive: false,
    } as any;

    const blog = await Blog.create(newBlog);

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


// ============================================
// 🤖 AI PLATFORM PUBLISH (JSON - no file upload)
// ============================================

const VALID_MAIN_CATEGORIES = [
  "Main Service Categories",
  "Industry-Specific Insights",
  "Business Growth & Strategy",
  "Company Culture & Updates",
] as const;

const VALID_SUBCATEGORIES = [
  "Customer Experience (CX)",
  "Back Office Solutions",
  "Virtual Assistance",
  "Sales & Lead Generation",
  "E-commerce Support",
  "Real Estate Outsourcing",
  "Healthcare BPO",
  "Tech & SaaS Scaling",
  "Scale Smarter",
  "Outsourcing 101",
  "Cost Optimization",
  "TelexPH Life",
  "News & Press Releases",
] as const;

const normalizeToEnum = <T extends string>(
  input: string,
  validValues: readonly T[]
): T | null => {
  if (!input) return null;
  const trimmed = input.trim();
  const exactMatch = validValues.find((v) => v === trimmed);
  if (exactMatch) return exactMatch;
  const caseInsensitive = validValues.find(
    (v) => v.toLowerCase() === trimmed.toLowerCase()
  );
  if (caseInsensitive) return caseInsensitive;
  return null;
};

/**
 * ✅ AI PLATFORM PAYLOAD TRANSFORMER
 *
 * FORMAT A — Sight AI (nested article object):
 *   body.article.title          → title
 *   body.article.summary        → shortDescription
 *   body.article.content        → mainContent
 *   body.article.slug           → slug
 *   body.article.main_image_url → pictureUrl
 *   body.article.author_name    → author
 *
 * FORMAT B — SEO Autopilot (flat body):
 *   body.content        → mainContent
 *   body.excerpt        → shortDescription
 *   body.featured_image → pictureUrl
 */
const transformSeoAutopilotPayload = (body: Record<string, any>): Record<string, any> => {
  const transformed = { ...body };

  // ============================================
  // 🤖 SIGHT AI — Unwrap nested article object
  // ============================================
  if (body.article && typeof body.article === "object") {
    const article = body.article;
    console.log("🔧 [Transform] Sight AI format detected — unwrapping article object");

    if (!transformed.title && article.title) {
      transformed.title = article.title;
      console.log(`🔧 [Transform] title → from article.title: "${article.title}"`);
    }
    if (!transformed.slug && article.slug) {
      transformed.slug = article.slug;
      console.log(`🔧 [Transform] slug → from article.slug`);
    }
    if (!transformed.author && article.author_name) {
      transformed.author = article.author_name;
      console.log(`🔧 [Transform] author → from article.author_name: "${article.author_name}"`);
    }
    if (!transformed.shortDescription) {
      const desc = article.summary || article.seo_meta_description || "";
      if (desc) {
        transformed.shortDescription = desc.trim().slice(0, 300);
        console.log(`🔧 [Transform] shortDescription → from article.summary`);
      }
    }
    if (!transformed.content && article.content) {
      transformed.content = article.content;
      console.log(`🔧 [Transform] content → from article.content`);
    }
    if (!transformed.pictureUrl && !transformed.picture) {
      const imageUrl = article.main_image_url || article.thumbnail_image_url || "";
      if (imageUrl) {
        transformed.pictureUrl = imageUrl;
        console.log(`🔧 [Transform] pictureUrl → from article.main_image_url`);
      }
    }
    if (!transformed.focus_keyword && article.target_keyword) {
      transformed.focus_keyword = article.target_keyword;
    }
    if (!transformed.status) {
      transformed.status = "published";
      console.log(`🔧 [Transform] status → defaulted to "published"`);
    }
  }

  // ============================================
  // 🔧 COMMON TRANSFORMS (both formats)
  // ============================================

  // --- author fallback ---
  if (!transformed.author) {
    transformed.author = "TelexPH Team";
    console.log(`🔧 [Transform] author → defaulted to "TelexPH Team"`);
  }

  // --- shortDescription fallback ---
  if (!transformed.shortDescription) {
    const fallback = transformed.excerpt || transformed.meta_description || "";
    if (fallback) {
      transformed.shortDescription = fallback.trim().slice(0, 300);
      console.log(`🔧 [Transform] shortDescription → mapped from excerpt/meta_description`);
    }
  }

  // --- pictureUrl fallback ---
  if (!transformed.pictureUrl && !transformed.picture) {
    const imageUrl =
      transformed.featured_image ||
      transformed.featured_image_url ||
      "https://res.cloudinary.com/dyhytmzqk/image/upload/v1/telexph/blog-default.jpg";
    transformed.pictureUrl = imageUrl;
    console.log(`🔧 [Transform] pictureUrl → fallback: "${imageUrl}"`);
  }

  // --- mainContent ---
  if (!transformed.mainContent && transformed.content) {
    const htmlContent = transformed.content as string;
    const sections: { title: string; content: string }[] = [];

    const h2Regex = /<h2[^>]*>(.*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi;
    let match;
    while ((match = h2Regex.exec(htmlContent)) !== null) {
      const sectionTitle = match[1]?.replace(/<[^>]+>/g, "").trim() || "Section";
      const sectionContent = match[2]?.trim() || "";
      if (sectionTitle && sectionContent) {
        sections.push({ title: sectionTitle, content: sectionContent });
      }
    }

    if (sections.length === 0) {
      sections.push({
        title: transformed.title || "Content",
        content: htmlContent,
      });
    }

    transformed.mainContent = sections;
    console.log(`🔧 [Transform] mainContent → built from HTML (${sections.length} section(s))`);
  }

  // --- mainCategory + subcategory ---
  if (!transformed.mainCategory) {
    const keyword = (transformed.focus_keyword || "").toLowerCase();
    const titleLower = (transformed.title || "").toLowerCase();

    let inferredCategory: typeof VALID_MAIN_CATEGORIES[number] = "Business Growth & Strategy";
    let inferredSubcategory: typeof VALID_SUBCATEGORIES[number] = "Scale Smarter";

    if (
      keyword.includes("customer") || keyword.includes("cx") || keyword.includes("support") ||
      titleLower.includes("customer") || titleLower.includes("support")
    ) {
      inferredCategory = "Main Service Categories";
      inferredSubcategory = "Customer Experience (CX)";
    } else if (
      keyword.includes("virtual") || keyword.includes("assistant") ||
      titleLower.includes("virtual assistant")
    ) {
      inferredCategory = "Main Service Categories";
      inferredSubcategory = "Virtual Assistance";
    } else if (
      keyword.includes("sales") || keyword.includes("lead") ||
      titleLower.includes("sales") || titleLower.includes("lead generation")
    ) {
      inferredCategory = "Main Service Categories";
      inferredSubcategory = "Sales & Lead Generation";
    } else if (
      keyword.includes("back office") || keyword.includes("back-office") ||
      titleLower.includes("back office")
    ) {
      inferredCategory = "Main Service Categories";
      inferredSubcategory = "Back Office Solutions";
    } else if (
      keyword.includes("ecommerce") || keyword.includes("e-commerce") || keyword.includes("shopify") ||
      titleLower.includes("ecommerce") || titleLower.includes("e-commerce")
    ) {
      inferredCategory = "Industry-Specific Insights";
      inferredSubcategory = "E-commerce Support";
    } else if (
      keyword.includes("real estate") || titleLower.includes("real estate")
    ) {
      inferredCategory = "Industry-Specific Insights";
      inferredSubcategory = "Real Estate Outsourcing";
    } else if (
      keyword.includes("healthcare") || keyword.includes("medical") ||
      titleLower.includes("healthcare") || titleLower.includes("medical")
    ) {
      inferredCategory = "Industry-Specific Insights";
      inferredSubcategory = "Healthcare BPO";
    } else if (
      keyword.includes("saas") || keyword.includes("tech") || keyword.includes("software") ||
      titleLower.includes("saas") || titleLower.includes("tech")
    ) {
      inferredCategory = "Industry-Specific Insights";
      inferredSubcategory = "Tech & SaaS Scaling";
    } else if (
      keyword.includes("outsourc") || titleLower.includes("outsourc")
    ) {
      inferredCategory = "Business Growth & Strategy";
      inferredSubcategory = "Outsourcing 101";
    } else if (
      keyword.includes("cost") || keyword.includes("saving") ||
      titleLower.includes("cost") || titleLower.includes("saving")
    ) {
      inferredCategory = "Business Growth & Strategy";
      inferredSubcategory = "Cost Optimization";
    } else if (
      keyword.includes("culture") || keyword.includes("telex life") ||
      titleLower.includes("telex life") || titleLower.includes("our team")
    ) {
      inferredCategory = "Company Culture & Updates";
      inferredSubcategory = "TelexPH Life";
    } else if (
      keyword.includes("news") || keyword.includes("press") || keyword.includes("announcement") ||
      titleLower.includes("announcement") || titleLower.includes("press release")
    ) {
      inferredCategory = "Company Culture & Updates";
      inferredSubcategory = "News & Press Releases";
    }

    transformed.mainCategory = inferredCategory;
    transformed.subcategory = inferredSubcategory;
    console.log(`🔧 [Transform] mainCategory → inferred: "${inferredCategory}"`);
    console.log(`🔧 [Transform] subcategory  → inferred: "${inferredSubcategory}"`);
  }

  return transformed;
};

export const aiPublishBlog = async (req: Request, res: Response) => {
  const hasBody = req.body && Object.keys(req.body).length > 0;

  if (!hasBody) {
    return res.status(200).json({
      status: "ok",
      message: "TelexPH Blog AI endpoint ready",
      note: "This endpoint auto-maps SEO Autopilot fields to our schema.",
      field_mapping: {
        "content (HTML)"        : "→ mainContent (auto-parsed into sections)",
        "excerpt"               : "→ shortDescription",
        "featured_image"        : "→ picture",
        "slug"                  : "→ slug (used as-is)",
        "title"                 : "→ title",
        "status"                : "→ status",
        "(not sent) author"     : "→ defaults to 'TelexPH Team'",
        "(not sent) category"   : "→ mainCategory + subcategory inferred from title/keyword",
      },
      mainCategories: VALID_MAIN_CATEGORIES,
      subcategories: VALID_SUBCATEGORIES,
      statusOptions: ["published", "draft", "scheduled"],
    });
  }

  console.log("🤖 ===== AI PUBLISH REQUEST =====");
  console.log("📥 Raw body received:", JSON.stringify(req.body, null, 2));
  console.log("📋 Fields received:", Object.keys(req.body));

  // ✅ STEP 1: Transform SEO Autopilot fields → our schema fields
  let bodyToValidate = transformSeoAutopilotPayload({ ...req.body });

  // ✅ STEP 2: Parse mainContent if still a string after transform
  if (typeof bodyToValidate.mainContent === "string") {
    try {
      bodyToValidate.mainContent = JSON.parse(bodyToValidate.mainContent);
    } catch (e) {
      console.error("❌ [AI Publish] mainContent parse error:", e);
      return res.status(400).json({ error: "Invalid format for mainContent" });
    }
  }

  // ✅ STEP 3: Clean up scheduledDate
  if (
    bodyToValidate.scheduledDate === "" ||
    bodyToValidate.scheduledDate === "null" ||
    bodyToValidate.scheduledDate === "undefined"
  ) {
    bodyToValidate.scheduledDate = undefined;
  }

  // ✅ STEP 4: Normalize mainCategory + subcategory (fix case/spacing issues)
  if (typeof bodyToValidate.mainCategory === "string") {
    const normalized = normalizeToEnum(bodyToValidate.mainCategory, VALID_MAIN_CATEGORIES);
    if (normalized) {
      console.log(`🔧 [Normalize] mainCategory: "${bodyToValidate.mainCategory}" → "${normalized}"`);
      bodyToValidate.mainCategory = normalized;
    }
  }

  if (typeof bodyToValidate.subcategory === "string") {
    const normalized = normalizeToEnum(bodyToValidate.subcategory, VALID_SUBCATEGORIES);
    if (normalized) {
      console.log(`🔧 [Normalize] subcategory: "${bodyToValidate.subcategory}" → "${normalized}"`);
      bodyToValidate.subcategory = normalized;
    }
  }

  console.log("🔍 [AI Publish] Body ready for validation:", JSON.stringify({
    title: bodyToValidate.title,
    author: bodyToValidate.author,
    mainCategory: bodyToValidate.mainCategory,
    subcategory: bodyToValidate.subcategory,
    shortDescription: bodyToValidate.shortDescription?.slice(0, 80) + "...",
    mainContentSections: Array.isArray(bodyToValidate.mainContent) ? bodyToValidate.mainContent.length : 0,
    status: bodyToValidate.status,
    pictureUrl: bodyToValidate.pictureUrl,
  }, null, 2));

  // ✅ STEP 5: Validate against schema
  const parsedBody = createBlogSchema.safeParse(bodyToValidate);

  if (!parsedBody.success) {
    console.error("❌ [AI Publish] Validation STILL failed after transform. Issues:");
    parsedBody.error.issues.forEach((issue, i) => {
      console.error(`   [${i + 1}] path: ${issue.path.join(".")} | message: ${issue.message}`);
    });
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body does not match the expected schema even after auto-mapping.",
      details: parsedBody.error.issues,
      debug: {
        title: bodyToValidate.title,
        author: bodyToValidate.author,
        mainCategory: bodyToValidate.mainCategory,
        subcategory: bodyToValidate.subcategory,
        shortDescriptionLength: bodyToValidate.shortDescription?.length ?? 0,
        mainContentIsArray: Array.isArray(bodyToValidate.mainContent),
        mainContentLength: Array.isArray(bodyToValidate.mainContent) ? bodyToValidate.mainContent.length : 0,
        status: bodyToValidate.status,
      },
    });
  }

  const body: CreateBlogDto = parsedBody.data;

  // ✅ Helper: wrap any promise with a hard timeout
  const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`[TIMEOUT] ${label} exceeded ${ms}ms`)), ms)
      ),
    ]);
  };

  try {
    // ✅ Use slug from body (Sight AI sends this), else generate from title
    const rawSlug: string = (bodyToValidate.slug as string) || toSlug(body.title);

    // ✅ Slug uniqueness check — 5s max
    let finalSlug = rawSlug;
    const existingWithSlug = await withTimeout(
      Blog.findOne({ slug: rawSlug }).maxTimeMS(5000).exec(),
      6000,
      "slug check"
    );
    if (existingWithSlug) {
      finalSlug = `${rawSlug}-${Date.now()}`;
      console.warn(`⚠️ [AI Publish] Slug collision detected. Using fallback: ${finalSlug}`);
    }

    // ✅ Picture URL: from transformed body or default
    const pictureUrl: string =
      bodyToValidate.pictureUrl ||
      "https://res.cloudinary.com/dyhytmzqk/image/upload/v1/telexph/blog-default.jpg";

    const newBlog = {
      ...body,
      slug: finalSlug,
      picture: pictureUrl,
      scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
      likeCount: 0,
      likedBy: [],
      isArchive: false,
    };

    // ✅ Blog.create with 8s hard timeout — prevents Sight AI from getting 503
    const blog = (await withTimeout(
      Blog.create(newBlog as any),
      8000,
      "Blog.create"
    )) as IBlog & { _id: mongoose.Types.ObjectId };

    console.log(`✅ [AI Publish] Blog SAVED TO DATABASE:`);
    console.log(`   - Title    : "${blog.title}"`);
    console.log(`   - Slug     : ${blog.slug}`);
    console.log(`   - ID       : ${blog._id}`);
    console.log(`   - Status   : ${blog.status}`);
    console.log(`   - Category : ${blog.mainCategory} > ${blog.subcategory}`);
    console.log(`   - Author   : ${blog.author}`);

    console.log("🎉 ===== AI PUBLISH COMPLETE =====\n");

    // ✅ FIX: Respond IMMEDIATELY — do not block on logActivity
    // Sight AI has a short timeout; if we await logActivity first, it times out → 503
    res.status(201).json(blog);

    // 🔥 Fire-and-forget: log in background after response is already sent
    const adminEmail = getUserEmailFromRequest(req);
    logActivity({
      action: "CREATED",
      module: "BLOGS",
      admin: adminEmail || "AI Platform",
      details: {
        blogId: blog._id.toString(),
        title: blog.title,
        slug: blog.slug,
        status: blog.status,
        mainCategory: blog.mainCategory,
        subcategory: blog.subcategory,
        author: blog.author,
        description: `[AI Platform] Created blog post "${blog.title}"`,
      },
      req,
    }).catch((err) =>
      console.error("❌ [AI Publish] Background logActivity error:", err)
    );

  } catch (error) {
    if (error instanceof Error) {
      console.error("❌ AI Publish blog error:", error.message);
      console.error("❌ Stack:", error.stack);
      res.status(400).json({ error: error.message });
    } else {
      console.error("❌ AI Publish unknown error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};


// ============================================
// 📋 GET ALL BLOGS
// ============================================
export const getAllBlogs = async (req: Request, res: Response) => {
  try {
    await autoPublishScheduledBlogs();

    const { search, mainCategory, subcategory, status, author, sortBy, order, includeArchived } = req.query;

    const filter: any = includeArchived === "true"
      ? { isArchive: true }
      : { isArchive: { $ne: true } };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { shortDescription: { $regex: search, $options: "i" } },
        { "mainContent.title": { $regex: search, $options: "i" } },
        { "mainContent.content": { $regex: search, $options: "i" } },
      ];
    }

    if (mainCategory) filter.mainCategory = mainCategory;
    if (subcategory) filter.subcategory = subcategory;
    if (status) filter.status = status;
    if (author) filter.author = author;

    const sort: any = {};
    if (sortBy) {
      sort[sortBy as string] = order === "desc" ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }

    const blogs = await Blog.find(filter).sort(sort).exec();

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


// ============================================
// 📖 GET SINGLE BLOG BY ID
// ============================================
export const getBlog = async (req: Request, res: Response) => {
  console.log("\n📖 ===== GET BLOG =====");

  await autoPublishScheduledBlogs();

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
    const blog = await Blog.findById(param.id).exec();

    if (!blog) {
      console.error("❌ Blog not found with ID:", param.id);
      return res.status(404).json({ error: "Blog not found" });
    }

    console.log("✅ Found blog:", blog.title);

    try {
      await trackView({
        resourceType: 'blog',
        resourceId: blog._id.toString(),
        req,
      });
      console.log("✅ View tracked successfully");
    } catch (viewError) {
      console.error("⚠️ Error tracking view (non-critical):", viewError instanceof Error ? viewError.message : viewError);
    }

    console.log("🎉 ===== END GET BLOG =====\n");

    res.status(200).json(blog);
  } catch (error) {
    console.error("❌ GET BLOG ERROR:", error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};


// ============================================
// 🔍 GET BLOG BY SLUG
// ============================================
export const getBlogBySlug = async (req: Request, res: Response) => {
  console.log("\n🔍 ===== FETCH BLOG BY SLUG =====");

  await autoPublishScheduledBlogs();

  try {
    const { slug } = req.params;
    console.log("📋 Fetching blog with slug:", slug);

    if (!slug) {
      return res.status(400).json({ error: "Slug parameter is required" });
    }

    const blog = await Blog.findOne({ slug }).exec();

    if (!blog) {
      console.error("❌ Blog not found with slug:", slug);
      return res.status(404).json({ error: "Blog not found" });
    }

    console.log("✅ Found blog:", blog.title);

    try {
      await trackView({
        resourceType: 'blog',
        resourceId: blog._id.toString(),
        req,
      });
      console.log("✅ View tracked successfully");
    } catch (viewError) {
      console.error("⚠️ Error tracking view (non-critical):", viewError instanceof Error ? viewError.message : viewError);
    }

    console.log("🎉 ===== END FETCH BLOG BY SLUG =====\n");

    res.status(200).json(blog);
  } catch (error) {
    console.error("❌ FETCH BY SLUG ERROR:", error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};


// ============================================
// 🔄 UPDATE BLOG
// ============================================
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

  let bodyToValidate = { ...req.body };

  console.log("🔍 RAW body before parsing:", bodyToValidate);

  if (typeof bodyToValidate.mainContent === 'string') {
    try {
      bodyToValidate.mainContent = JSON.parse(bodyToValidate.mainContent);
      console.log("✅ Parsed mainContent:", bodyToValidate.mainContent);
    } catch (e) {
      return res.status(400).json({ error: "Invalid format for mainContent" });
    }
  }

  if (bodyToValidate.scheduledDate === "" || bodyToValidate.scheduledDate === "null" || bodyToValidate.scheduledDate === "undefined") {
    bodyToValidate.scheduledDate = null;
    console.log("🗑️  ScheduledDate set to null (will be removed)");
  }

  console.log("🔍 Body after preprocessing:", JSON.stringify(bodyToValidate, null, 2));

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
    const existingBlog = await Blog.findById(param.id).exec();
    if (!existingBlog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    console.log("📖 Existing blog state:");
    console.log("   - Title:", existingBlog.title);
    console.log("   - Picture:", existingBlog.picture);
    console.log("   - Status:", existingBlog.status);
    console.log("   - ScheduledDate:", existingBlog.scheduledDate);

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

    let pictureUrl: string | undefined;
    let hasPictureUpdate = false;

    if (req.file) {
      console.log("🖼️  New file detected, uploading...");
      const result = await uploadFile(req.file);

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

    const updateData: Partial<IBlog> = {} as any;

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

    if (body.title) {
      updateData.slug = toSlug(body.title);
    }

    if (hasPictureUpdate) {
      updateData.picture = pictureUrl!;
      console.log("🖼️  ========== PICTURE UPDATE ==========");
      console.log("🖼️  Old picture:", existingBlog.picture);
      console.log("🖼️  New picture:", pictureUrl);
    } else {
      console.log("🖼️  Picture remains unchanged:", existingBlog.picture);
    }

    console.log("📝 Final update data:", JSON.stringify(updateData, null, 2));

    if (updateData.scheduledDate !== undefined) {
      if (updateData.scheduledDate === null) {
        delete (updateData as any).scheduledDate;
        console.log("🗑️  Removing scheduledDate (set to undefined)");
      } else {
        updateData.scheduledDate = new Date(updateData.scheduledDate);
        console.log("📅 Updated scheduledDate:", updateData.scheduledDate);
      }
    }

    const blog = await Blog.findByIdAndUpdate(param.id, updateData, {
      new: true,
      runValidators: true,
    }).exec();

    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    console.log("✅ ========== UPDATE COMPLETE ==========");
    console.log("✅ Blog updated successfully!");

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


// ============================================
// 🗄️ ARCHIVE BLOG (soft delete)
// ============================================
export const archiveBlog = async (req: Request, res: Response) => {
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    const existingBlog = await Blog.findById(param.id).exec();
    if (!existingBlog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    if (existingBlog.isArchive) {
      return res.status(400).json({ error: "Blog is already archived" });
    }

    const blog = await Blog.findByIdAndUpdate(
      param.id,
      { isArchive: true },
      { new: true }
    ).exec();

    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "DELETED",
      module: "BLOGS",
      admin: adminEmail,
      details: {
        blogId: existingBlog._id.toString(),
        title: existingBlog.title,
        slug: existingBlog.slug,
        status: existingBlog.status,
        mainCategory: existingBlog.mainCategory,
        subcategory: existingBlog.subcategory,
        author: existingBlog.author.toString(),
        scheduledDate: existingBlog.scheduledDate?.toISOString(),
        description: `Archived blog post "${existingBlog.title}"`,
      },
      req,
    });

    res.status(200).json({ message: "Blog archived successfully", data: blog });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Archiving blog error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Blog error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};


// ============================================
// 🆕 LIKE / UNLIKE FUNCTIONALITY
// ============================================
export const likeBlog = async (req: Request, res: Response) => {
  try {
    const blogId = req.params.id;
    const userIdentifier = getUserIdentifier(req);

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    if (blog.likedBy.includes(userIdentifier)) {
      return res.status(400).json({
        message: "You have already liked this blog",
        likeCount: blog.likeCount,
        hasLiked: true
      });
    }

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

export const unlikeBlog = async (req: Request, res: Response) => {
  try {
    const blogId = req.params.id;
    const userIdentifier = getUserIdentifier(req);

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    if (!blog.likedBy.includes(userIdentifier)) {
      return res.status(400).json({
        message: "You haven't liked this blog yet",
        likeCount: blog.likeCount,
        hasLiked: false
      });
    }

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


// ============================================
// 🔄 RESTORE BLOG (unarchive)
// ============================================
export const restoreBlog = async (req: Request, res: Response) => {
  const parsed = getParamSchema.safeParse(req.params);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    const existingBlog = await Blog.findById(param.id).exec();
    if (!existingBlog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    if (!existingBlog.isArchive) {
      return res.status(400).json({ error: "Blog is not archived" });
    }

    const blog = await Blog.findByIdAndUpdate(
      param.id,
      { isArchive: false },
      { new: true }
    ).exec();

    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "RESTORED" as ActivityAction,
      module: "BLOGS",
      admin: adminEmail,
      details: {
        blogId: existingBlog._id.toString(),
        title: existingBlog.title,
        slug: existingBlog.slug,
        status: existingBlog.status,
        mainCategory: existingBlog.mainCategory,
        subcategory: existingBlog.subcategory,
        author: existingBlog.author.toString(),
        description: `Restored blog post "${existingBlog.title}" from archive`,
      },
      req,
    });

    res.status(200).json({ message: "Blog restored successfully", data: blog });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Restoring blog error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Blog error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};