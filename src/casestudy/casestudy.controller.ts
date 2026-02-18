import type { Request, Response } from "express";
import CaseStudy from "./CaseStudy.ts";
import { toSlug } from "../common/utils/to-slug.util.ts";
import {
  getParamSchema,
  type GetParamDto,
} from "../common/dto/get-param.dto.ts";
import uploadFile from "../common/utils/upload-file.util.ts";
import { trackView } from "../common/services/analytics.service.ts";
import { logActivity, getUserEmailFromRequest, type ActivityAction } from "../common/services/activity-log.service.ts";

// Helper function to extract user ID from request (tries all possible locations)
const getUserId = (req: Request): string | null => {
  const user = (req as any).user;
  
  if (!user) {
    console.error("❌ No user object found in request");
    return null;
  }
  
  console.log("✅ User object found:", JSON.stringify(user, null, 2));
  
  // Try all possible property names
  const userId = 
    user.id || 
    user._id || 
    user.userId || 
    user.sub ||
    user.user_id ||
    user.ID ||
    (typeof user === 'string' ? user : null);
  
  if (!userId) {
    console.error("❌ User object exists but no ID found in these properties:", Object.keys(user));
    return null;
  }
  
  console.log("✅ Found user ID:", userId);
  return userId.toString();
};

// Helper function to get client IP address
const getClientIp = (req: Request): string => {
  // Try to get IP from various headers (for proxy/load balancer scenarios)
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, get the first one
    const ips = (forwarded as string).split(',');
    return (ips[0] ?? 'unknown').trim();
  }
  
  if (realIp) {
    return realIp as string;
  }
  
  // Fallback to socket remote address
  return req.socket.remoteAddress || 'unknown';
};

// Helper function to parse form-data into proper structure
const parseFormData = (body: any) => {
  console.log("📦 Parsing form data...");
  
  // Parse sections from flat subtitle/text fields
  const sections = [];
  let i = 0;
  while (body[`subtitle${i}`] !== undefined || body[`text${i}`] !== undefined) {
    if (body[`subtitle${i}`] && body[`text${i}`]) {
      sections.push({
        subtitle: body[`subtitle${i}`],
        text: body[`text${i}`],
      });
    }
    i++;
  }
  
  console.log(`✅ Found ${sections.length} sections`);

  // Parse tags (can be comma-separated string or already array)
  let tags = body.tags || [];
  if (typeof tags === "string") {
    tags = tags.split(",").map((tag: string) => tag.trim()).filter(Boolean);
  }
  console.log("✅ Tags:", tags);

  // Parse challenge (can be string or array)
  let challenge = [];
  if (typeof body.challenge === "string" && body.challenge.trim()) {
    challenge = [{ title: "Challenge", text: body.challenge }];
  } else if (Array.isArray(body.challenge)) {
    challenge = body.challenge;
  }
  console.log("✅ Challenges:", challenge.length);

  // Parse solution (can be string or array)
  let solution = [];
  if (typeof body.solution === "string" && body.solution.trim()) {
    solution = [{ title: "Solution", text: body.solution }];
  } else if (Array.isArray(body.solution)) {
    solution = body.solution;
  }
  console.log("✅ Solutions:", solution.length);

  // Parse dates
  const startDate = body.startDate ? new Date(body.startDate) : undefined;
  const endDate = body.endDate ? new Date(body.endDate) : undefined;
  const isUnfinished = body.isUnfinished === "true" || body.isUnfinished === true;
  const scheduleDate = body.scheduleDate ? new Date(body.scheduleDate) : undefined;
  const scheduleTime = body.scheduleTime || undefined;

  return {
    title: body.title,
    subtitle: body.subtitle || undefined,
    author: body.author,
    status: body.status,
    tags,
    sections,
    challenge,
    solution,
    startDate,
    endDate,
    isUnfinished,
    scheduleDate,
    scheduleTime,
  };
};

// Adding case study
export const addCaseStudy = async (req: Request, res: Response) => {
  console.log("\n🚀 ===== CREATE CASE STUDY REQUEST =====");
  
  try {
    // Parse form data
    const parsedData = parseFormData(req.body);
    console.log("📋 Parsed data:", {
      title: parsedData.title,
      subtitle: parsedData.subtitle,
      author: parsedData.author,
      status: parsedData.status,
      sectionsCount: parsedData.sections.length,
      challengeCount: parsedData.challenge.length,
      solutionCount: parsedData.solution.length,
      startDate: parsedData.startDate,
      endDate: parsedData.endDate,
      isUnfinished: parsedData.isUnfinished,
      scheduleDate: parsedData.scheduleDate,
      scheduleTime: parsedData.scheduleTime,
    });

    // Validate required fields
    if (!parsedData.title) {
      return res.status(400).json({ error: "Title is required" });
    }
    if (!parsedData.author) {
      return res.status(400).json({ error: "Author is required" });
    }
    if (!parsedData.status) {
      return res.status(400).json({ error: "Status is required" });
    }

    // VALIDATION LOGIC FOR SECTIONS
    if (parsedData.status === 'draft') {
      // If Draft, require at least 1 section
      if (parsedData.sections.length < 1) {
        return res.status(400).json({ error: "Drafts require at least 1 content section" });
      }
    } else {
      // If Active/Completed/Scheduled, require EXACTLY 5
      if (parsedData.sections.length !== 5) {
        return res.status(400).json({ 
          error: "Status '" + parsedData.status + "' requires exactly 5 content sections",
          received: parsedData.sections.length,
          hint: "Fill out all 5 topics and content fields"
        });
      }
    }

    if (parsedData.challenge.length === 0) {
      return res.status(400).json({ error: "At least one challenge is required" });
    }
    if (parsedData.solution.length === 0) {
      return res.status(400).json({ error: "At least one solution is required" });
    }

    // File uploading
    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ error: "Cover image is required" });
    }
    
    console.log("📤 Uploading cover image...");
    const url = await uploadFile(file);
    console.log("✅ Cover uploaded:", url);

    // Create case study object with all fields
    console.log("💾 Creating case study in database...");
    const caseStudyData: any = {
      title: parsedData.title,
      slug: toSlug(parsedData.title),
      cover: url,
      status: parsedData.status,
      tags: parsedData.tags,
      author: parsedData.author,
      sections: parsedData.sections,
      challenge: parsedData.challenge,
      solution: parsedData.solution,
      isUnfinished: parsedData.isUnfinished,
    };

    // Add optional fields only if they exist
    if (parsedData.subtitle) caseStudyData.subtitle = parsedData.subtitle;
    if (parsedData.startDate) caseStudyData.startDate = parsedData.startDate;
    if (parsedData.endDate) caseStudyData.endDate = parsedData.endDate;
    if (parsedData.scheduleDate) caseStudyData.scheduleDate = parsedData.scheduleDate;
    if (parsedData.scheduleTime) caseStudyData.scheduleTime = parsedData.scheduleTime;

    const newCaseStudy = await CaseStudy.create(caseStudyData);

    console.log("✅ Case study created successfully!");

    // 🔴 LOG ACTIVITY - Case Study Created
    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "CREATED",
      module: "CASESTUDY",
      admin: adminEmail,
      details: {
        caseStudyId: newCaseStudy._id.toString(),
        title: newCaseStudy.title,
        slug: newCaseStudy.slug,
        status: newCaseStudy.status,
        tags: newCaseStudy.tags,
        author: newCaseStudy.author,
      },
      req,
    });

    console.log("🎉 ===== END CREATE CASE STUDY =====\n");

    res.status(201).json(newCaseStudy);
  } catch (error) {
    console.error("❌ CREATE ERROR:", error);
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

// Fetching all case studies with filtering
export const getAllCaseStudies = async (req: Request, res: Response) => {
  console.log("\n📚 ===== GET ALL CASE STUDIES =====");
  
  try {
    const { status, tags, search, sortBy, order, includeArchived } = req.query;
    console.log("🔍 Query params:", { status, tags, search, sortBy, order, includeArchived });

    // If includeArchived=true, show ONLY archived case studies (for the archive management page)
    // Otherwise only show non-archived case studies
    const filter: any = includeArchived === "true"
      ? { isArchived: true }
      : { isArchived: { $ne: true } };

    if (status) {
      filter.status = status;
    }

    if (tags) {
      const tagArray = (tags as string).split(",");
      filter.tags = { $in: tagArray };
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { subtitle: { $regex: search, $options: "i" } },
        { "sections.subtitle": { $regex: search, $options: "i" } },
        { "sections.text": { $regex: search, $options: "i" } },
      ];
    }

    const sort: any = {};
    if (sortBy) {
      sort[sortBy as string] = order === "desc" ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }

    console.log("🔍 Filter:", filter);
    console.log("📊 Sort:", sort);

    const caseStudies = await CaseStudy.find(filter).sort(sort).exec();

    console.log(`✅ Found ${caseStudies.length} case studies`);
    console.log("🎉 ===== END GET ALL CASE STUDIES =====\n");

    res.status(200).json(caseStudies);
  } catch (error: unknown) {
    console.error("❌ GET ALL ERROR:", error);
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

// Fetching single case study by ID with view tracking
export const getCaseStudy = async (req: Request, res: Response) => {
  console.log("\n📖 ===== GET CASE STUDY =====");
  
  const parsed = getParamSchema.safeParse(req.params);
  if (!parsed.success) {
    console.error("❌ Validation failed:", parsed.error);
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;
  console.log("📋 Fetching case study with ID:", param.id);

  try {
    const caseStudy = await CaseStudy.findById(param.id).exec();

    if (!caseStudy) {
      console.error("❌ Case study not found with ID:", param.id);
      return res.status(404).json({ error: "Case study not found" });
    }

    console.log("✅ Found case study:", caseStudy.title);

    // Track view
    try {
      await trackView({
        resourceType: 'casestudy',
        resourceId: caseStudy._id.toString(),
        resourceTitle: caseStudy.title,
        req,
      });
    } catch (error) {
      console.error("Error tracking view (non-critical):", error instanceof Error ? error.message : error);
      // Continue execution even if analytics tracking fails
    }

    console.log("🎉 ===== END GET CASE STUDY =====\n");

    res.status(200).json(caseStudy);
  } catch (error) {
    console.error("❌ GET ERROR:", error);
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

// NEW: Fetching case study by slug (for frontend public pages)
export const fetchCaseStudyBySlug = async (req: Request, res: Response) => {
  console.log("\n🔍 ===== FETCH CASE STUDY BY SLUG =====");
  
  const { slug } = req.params;
  console.log("📋 Fetching case study with slug:", slug);

  try {
    const caseStudy = await CaseStudy.findOne({ slug: slug as string }).exec();

    if (!caseStudy) {
      console.error("❌ Case study not found with slug:", slug);
      return res.status(404).json({ error: "Case study not found" });
    }

    console.log("✅ Found case study:", caseStudy.title);

    // Track view
    try {
      await trackView({
        resourceType: 'casestudy',
        resourceId: caseStudy._id.toString(),
        resourceTitle: caseStudy.title,
        req,
      });
    } catch (error) {
      console.error("Error tracking view (non-critical):", error instanceof Error ? error.message : error);
      // Continue execution even if analytics tracking fails
    }

    console.log("🎉 ===== END FETCH CASE STUDY BY SLUG =====\n");

    res.status(200).json(caseStudy);
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

// NEW: Get case study for editing (no view tracking)
export const getCaseStudyForEdit = async (req: Request, res: Response) => {
  console.log("\n✏️ ===== GET CASE STUDY FOR EDIT =====");
  
  const parsed = getParamSchema.safeParse(req.params);
  if (!parsed.success) {
    console.error("❌ Validation failed:", parsed.error);
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;
  console.log("📋 Fetching case study for edit with ID:", param.id);

  try {
    const caseStudy = await CaseStudy.findById(param.id).exec();

    if (!caseStudy) {
      console.error("❌ Case study not found with ID:", param.id);
      return res.status(404).json({ error: "Case study not found" });
    }

    console.log("✅ Found case study for editing:", caseStudy.title);
    console.log("🎉 ===== END GET CASE STUDY FOR EDIT =====\n");

    res.status(200).json(caseStudy);
  } catch (error) {
    console.error("❌ GET FOR EDIT ERROR:", error);
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

// Updating case study
export const updateCaseStudy = async (req: Request, res: Response) => {
  console.log("\n🔄 ===== UPDATE CASE STUDY =====");
  
  const parsed = getParamSchema.safeParse(req.params);
  if (!parsed.success) {
    console.error("❌ Validation failed:", parsed.error);
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;
  console.log("📋 Updating case study with ID:", param.id);

  try {
    const existingCaseStudy = await CaseStudy.findById(param.id);
    if (!existingCaseStudy) {
      console.error("❌ Case study not found with ID:", param.id);
      return res.status(404).json({ error: "Case study not found" });
    }

    console.log("✅ Found case study to update:", existingCaseStudy.title);

    // Store old data for activity log
    const oldData = {
      title: existingCaseStudy.title,
      slug: existingCaseStudy.slug,
      status: existingCaseStudy.status,
      tags: existingCaseStudy.tags,
      author: existingCaseStudy.author,
    };

    // Parse form data
    const parsedData = parseFormData(req.body);
    console.log("📋 Parsed update data:", {
      title: parsedData.title,
      subtitle: parsedData.subtitle,
      author: parsedData.author,
      status: parsedData.status,
      sectionsCount: parsedData.sections.length,
    });

    const updateData: any = {};

    // Handle file upload if present
    if (req.file?.buffer) {
      console.log("📤 Uploading new cover image...");
      const url = await uploadFile(req.file);
      console.log("✅ New cover uploaded:", url);
      updateData.cover = url;
    }

    if (parsedData.title) {
      updateData.title = parsedData.title;
      updateData.slug = toSlug(parsedData.title);
    }
    if (parsedData.subtitle !== undefined) updateData.subtitle = parsedData.subtitle;
    if (parsedData.author) updateData.author = parsedData.author;
    if (parsedData.status) updateData.status = parsedData.status;
    if (parsedData.tags.length > 0) updateData.tags = parsedData.tags;
    
    if (parsedData.sections.length > 0) {
      // Check the NEW status being requested (parsedData.status) 
      // OR fallback to existing status if status isn't changing
      const targetStatus = parsedData.status || existingCaseStudy.status;

      if (targetStatus === 'draft') {
         // Draft rule: At least 1
         if (parsedData.sections.length < 1) {
            return res.status(400).json({ error: "Drafts require at least 1 content section" });
         }
      } else {
         // Active rule: Exactly 5
         if (parsedData.sections.length !== 5) {
            return res.status(400).json({ 
              error: "Status '" + targetStatus + "' requires exactly 5 content sections",
              received: parsedData.sections.length 
            });
         }
      }
      updateData.sections = parsedData.sections;
    }

    if (parsedData.challenge.length > 0) updateData.challenge = parsedData.challenge;
    if (parsedData.solution.length > 0) updateData.solution = parsedData.solution;
    
    // Update date fields
    if (parsedData.startDate !== undefined) updateData.startDate = parsedData.startDate;
    if (parsedData.endDate !== undefined) updateData.endDate = parsedData.endDate;
    if (parsedData.isUnfinished !== undefined) updateData.isUnfinished = parsedData.isUnfinished;
    if (parsedData.scheduleDate !== undefined) updateData.scheduleDate = parsedData.scheduleDate;
    if (parsedData.scheduleTime !== undefined) updateData.scheduleTime = parsedData.scheduleTime;

    console.log("💾 Updating case study in database...");
    const caseStudy = await CaseStudy.findByIdAndUpdate(param.id, updateData, {
      new: true,
      runValidators: true,
    }).exec();

    console.log("✅ Case study updated successfully!");

    // 🔴 LOG ACTIVITY - Case Study Updated
    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "UPDATED",
      module: "CASESTUDY",
      admin: adminEmail,
      details: {
        caseStudyId: caseStudy!._id.toString(),
        oldData,
        newData: {
          title: caseStudy!.title,
          slug: caseStudy!.slug,
          status: caseStudy!.status,
          tags: caseStudy!.tags,
          author: caseStudy!.author,
        },
        fieldsUpdated: Object.keys(updateData),
      },
      req,
    });

    console.log("🎉 ===== END UPDATE CASE STUDY =====\n");

    res.status(200).json(caseStudy);
  } catch (error) {
    console.error("❌ ERROR:", error);
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

// Archiving case study (soft delete)
export const archiveCaseStudy = async (req: Request, res: Response) => {
  console.log("\n📦 ===== ARCHIVE CASE STUDY =====");
  
  const parsed = getParamSchema.safeParse(req.params);
  if (!parsed.success) {
    console.error("❌ Validation failed:", parsed.error);
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;
  console.log("📋 Archiving case study with ID:", param.id);

  try {
    const existingCaseStudy = await CaseStudy.findById(param.id);
    if (!existingCaseStudy) {
      console.error("❌ Case study not found with ID:", param.id);
      return res.status(404).json({ error: "Case study not found" });
    }

    console.log("✅ Found case study to archive:", existingCaseStudy.title);

    // Store data for activity log
    const archivedData = {
      caseStudyId: existingCaseStudy._id.toString(),
      title: existingCaseStudy.title,
      slug: existingCaseStudy.slug,
      status: existingCaseStudy.status,
      tags: existingCaseStudy.tags,
      author: existingCaseStudy.author,
    };

    const caseStudy = await CaseStudy.findByIdAndUpdate(
      param.id,
      { isArchived: true },
      { new: true }
    ).exec();

    console.log("✅ Case study archived successfully!");

    // 🔴 LOG ACTIVITY - Case Study Archived
    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "ARCHIVED" as ActivityAction,
      module: "CASESTUDY",
      admin: adminEmail,
      details: archivedData,
      req,
    });

    console.log("🎉 ===== END ARCHIVE CASE STUDY =====\n");

    res.status(200).json({ message: "Case study archived successfully", data: caseStudy });
  } catch (error) {
    console.error("❌ ARCHIVE ERROR:", error);
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

// ============================================
// 👍 LIKE/UNLIKE FUNCTIONALITY
// ============================================

// Like a case study
export const likeCaseStudy = async (req: Request, res: Response) => {
  console.log("\n❤️ ===== LIKE CASE STUDY =====");
  
  const parsed = getParamSchema.safeParse(req.params);
  if (!parsed.success) {
    console.error("❌ Validation failed:", parsed.error);
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;
  console.log("📋 Like request for case study ID:", param.id);

  try {
    const caseStudy = await CaseStudy.findById(param.id);

    if (!caseStudy) {
      console.error("❌ Case study not found with ID:", param.id);
      return res.status(404).json({ error: "Case study not found" });
    }

    console.log("✅ Found case study:", caseStudy.title);

    // Get client IP address
    const clientIp = getClientIp(req);
    console.log("🌐 Client IP:", clientIp);

    // Check if this IP has already liked this case study
    const existingLike = caseStudy.likes.find(
      (like: any) => like.ipAddress === clientIp
    );

    if (existingLike) {
      console.log("⚠️ IP address has already liked this case study");
      return res.status(400).json({ 
        error: "You have already liked this case study",
        alreadyLiked: true,
        likesCount: caseStudy.likesCount,
        hasLiked: true
      });
    }

    // Add the new like
    caseStudy.likes.push({
      ipAddress: clientIp,
      likedAt: new Date(),
    });

    // Update likes count
    caseStudy.likesCount = caseStudy.likes.length;

    // Save the updated case study
    await caseStudy.save();

    console.log("✅ Like added successfully!");
    console.log(`📊 Total likes: ${caseStudy.likesCount}`);
    console.log("🎉 ===== END LIKE CASE STUDY =====\n");

    res.status(200).json({ 
      message: "Case study liked successfully",
      likesCount: caseStudy.likesCount,
      hasLiked: true
    });
  } catch (error: unknown) {
    console.error("❌ LIKE ERROR:", error);
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

// ============================================
// 💔 NEW: UNLIKE CASE STUDY FUNCTION
// ============================================
export const unlikeCaseStudy = async (req: Request, res: Response) => {
  console.log("\n💔 ===== UNLIKE CASE STUDY =====");
  
  const parsed = getParamSchema.safeParse(req.params);
  if (!parsed.success) {
    console.error("❌ Validation failed:", parsed.error);
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;
  console.log("📋 Unlike request for case study ID:", param.id);

  try {
    const caseStudy = await CaseStudy.findById(param.id);

    if (!caseStudy) {
      console.error("❌ Case study not found with ID:", param.id);
      return res.status(404).json({ error: "Case study not found" });
    }

    console.log("✅ Found case study:", caseStudy.title);

    // Get client IP address
    const clientIp = getClientIp(req);
    console.log("🌐 Client IP:", clientIp);

    // Check if this IP has liked this case study
    const existingLikeIndex = caseStudy.likes.findIndex(
      (like: any) => like.ipAddress === clientIp
    );

    if (existingLikeIndex === -1) {
      console.log("⚠️ IP address hasn't liked this case study yet");
      return res.status(400).json({ 
        error: "You haven't liked this case study yet",
        likesCount: caseStudy.likesCount,
        hasLiked: false
      });
    }

    // Remove the like
    caseStudy.likes.splice(existingLikeIndex, 1);

    // Update likes count
    caseStudy.likesCount = caseStudy.likes.length;

    // Save the updated case study
    await caseStudy.save();

    console.log("✅ Like removed successfully!");
    console.log(`📊 Total likes: ${caseStudy.likesCount}`);
    console.log("🎉 ===== END UNLIKE CASE STUDY =====\n");

    res.status(200).json({ 
      message: "Case study unliked successfully",
      likesCount: caseStudy.likesCount,
      hasLiked: false
    });
  } catch (error: unknown) {
    console.error("❌ UNLIKE ERROR:", error);
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

// ============================================
// ✅ NEW: CHECK LIKE STATUS FOR CASE STUDY
// ============================================
export const checkCaseStudyLikeStatus = async (req: Request, res: Response) => {
  console.log("\n🔍 ===== CHECK CASE STUDY LIKE STATUS =====");
  
  const parsed = getParamSchema.safeParse(req.params);
  if (!parsed.success) {
    console.error("❌ Validation failed:", parsed.error);
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;
  console.log("📋 Check like status for case study ID:", param.id);

  try {
    const caseStudy = await CaseStudy.findById(param.id);

    if (!caseStudy) {
      console.error("❌ Case study not found with ID:", param.id);
      return res.status(404).json({ error: "Case study not found" });
    }

    console.log("✅ Found case study:", caseStudy.title);

    // Get client IP address
    const clientIp = getClientIp(req);
    console.log("🌐 Client IP:", clientIp);

    // Check if this IP has liked this case study
    const hasLiked = caseStudy.likes.some(
      (like: any) => like.ipAddress === clientIp
    );

    console.log(`📊 Has liked: ${hasLiked}, Total likes: ${caseStudy.likesCount}`);
    console.log("🎉 ===== END CHECK CASE STUDY LIKE STATUS =====\n");

    res.status(200).json({ 
      hasLiked,
      likesCount: caseStudy.likesCount
    });
  } catch (error: unknown) {
    console.error("❌ CHECK LIKE STATUS ERROR:", error);
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
// ============================================
// 🔄 RESTORE CASE STUDY (unarchive)
// ============================================

export const restoreCaseStudy = async (req: Request, res: Response) => {
  console.log("\n🔄 ===== RESTORE CASE STUDY =====");

  const parsed = getParamSchema.safeParse(req.params);
  if (!parsed.success) {
    console.error("❌ Validation failed:", parsed.error);
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;
  console.log("📋 Restoring case study with ID:", param.id);

  try {
    const existingCaseStudy = await CaseStudy.findById(param.id);
    if (!existingCaseStudy) {
      console.error("❌ Case study not found with ID:", param.id);
      return res.status(404).json({ error: "Case study not found" });
    }

    // Check if case study is actually archived
    if (!existingCaseStudy.isArchived) {
      return res.status(400).json({ error: "Case study is not archived" });
    }

    console.log("✅ Found case study to restore:", existingCaseStudy.title);

    // Store data for activity log
    const restoredData = {
      caseStudyId: existingCaseStudy._id.toString(),
      title: existingCaseStudy.title,
      slug: existingCaseStudy.slug,
      status: existingCaseStudy.status,
      tags: existingCaseStudy.tags,
      author: existingCaseStudy.author,
    };

    const caseStudy = await CaseStudy.findByIdAndUpdate(
      param.id,
      { isArchived: false },
      { new: true }
    ).exec();

    console.log("✅ Case study restored successfully!");

    // 🟢 LOG ACTIVITY - Case Study Restored
    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "RESTORED" as ActivityAction,
      module: "CASESTUDY",
      admin: adminEmail,
      details: restoredData,
      req,
    });

    console.log("🎉 ===== END RESTORE CASE STUDY =====\n");

    res.status(200).json({ message: "Case study restored successfully", data: caseStudy });
  } catch (error) {
    console.error("❌ RESTORE ERROR:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Unknown error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};