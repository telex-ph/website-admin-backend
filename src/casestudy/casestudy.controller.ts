import type { Request, Response } from "express";
import CaseStudy from "./CaseStudy.ts";
import { toSlug } from "../common/utils/to-slug.util.ts";
import {
  getParamSchema,
  type GetParamDto,
} from "../common/dto/get-param.dto.ts";
import uploadFile from "../common/utils/upload-file.util.ts";
import { trackView } from "../common/services/analytics.service.ts";
import { logActivity, getUserEmailFromRequest } from "../common/services/activity-log.service.ts";

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
  } catch (error: unknown) {
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

// Fetching all case studies with advanced filtering
export const getAllCaseStudies = async (req: Request, res: Response) => {
  try {
    const { search, status, tags, sortBy, order, author } = req.query;
    const filter: any = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { subtitle: { $regex: search, $options: "i" } },
        { "sections.subtitle": { $regex: search, $options: "i" } },
        { "sections.text": { $regex: search, $options: "i" } },
        { "challenge.title": { $regex: search, $options: "i" } },
        { "challenge.text": { $regex: search, $options: "i" } },
        { "solution.title": { $regex: search, $options: "i" } },
        { "solution.text": { $regex: search, $options: "i" } },
      ];
    }

    if (status) filter.status = status;
    if (tags) {
      const tagsArray = typeof tags === "string" ? tags.split(",") : tags;
      filter.tags = { $in: tagsArray };
    }
    if (author) filter.author = author;

    const sort: any = {};
    if (sortBy) {
      sort[sortBy as string] = order === "desc" ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }

    const caseStudies = await CaseStudy.find(filter)
      .sort(sort)
      .exec();

    res.status(200).json(caseStudies);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Fetching single case study by ID with view tracking
export const getCaseStudy = async (req: Request, res: Response) => {
  const parsed = getParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    const caseStudy = await CaseStudy.findById(param.id)
      .exec();

    if (!caseStudy) {
      return res.status(404).json({ error: "Case study not found" });
    }

    trackView({
      resourceType: "casestudy",
      resourceId: param.id,
      req,
    }).catch((err) => console.error("View tracking error:", err));

    res.status(200).json(caseStudy);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Fetching single case study by slug with view tracking
export const fetchCaseStudyBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({
        error: "Validation failed",
        message: "Slug parameter is required",
      });
    }

    const caseStudy = await CaseStudy.findOne({ slug })
      .exec();

    if (!caseStudy) {
      return res.status(404).json({ error: "Case study not found" });
    }

    trackView({
      resourceType: "casestudy",
      resourceId: caseStudy._id.toString(),
      req,
    }).catch((err) => console.error("View tracking error:", err));

    res.status(200).json(caseStudy);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};


// Fetching single case study by ID for editing (WITHOUT view tracking)
export const getCaseStudyForEdit = async (req: Request, res: Response) => {
  const parsed = getParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    const caseStudy = await CaseStudy.findById(param.id)
      .exec();

    if (!caseStudy) {
      return res.status(404).json({ error: "Case study not found" });
    }

    // No analytics tracking - this is for editing only
    res.status(200).json(caseStudy);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Updating case study
export const updateCaseStudy = async (req: Request, res: Response) => {
  console.log("\n🔄 ===== UPDATE CASE STUDY REQUEST =====");
  
  const parsedParams = getParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsedParams.data;

  try {
    const existingCaseStudy = await CaseStudy.findById(param.id);
    if (!existingCaseStudy) {
      return res.status(404).json({ error: "Case study not found" });
    }

    // Store old data for activity log
    const oldData = {
      title: existingCaseStudy.title,
      slug: existingCaseStudy.slug,
      status: existingCaseStudy.status,
      tags: existingCaseStudy.tags,
      author: existingCaseStudy.author,
    };

    const parsedData = parseFormData(req.body);
    const updateData: any = {};

    // Handle cover image update if new file is provided
    const file = req.file;
    if (file?.buffer) {
      console.log("📤 Uploading new cover image...");
      const url = await uploadFile(file);
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
      if (parsedData.sections.length !== 5) {
        return res.status(400).json({ 
          error: "Exactly 5 content sections are required",
          received: parsedData.sections.length 
        });
      }
      
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
    })
      .exec();

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

// Deleting case study
export const deleteCaseStudy = async (req: Request, res: Response) => {
  const parsed = getParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsed.data;

  try {
    const existingCaseStudy = await CaseStudy.findById(param.id);
    if (!existingCaseStudy) {
      return res.status(404).json({ error: "Case study not found" });
    }

    // Store data before deletion for activity log
    const deletedData = {
      caseStudyId: existingCaseStudy._id.toString(),
      title: existingCaseStudy.title,
      slug: existingCaseStudy.slug,
      status: existingCaseStudy.status,
      tags: existingCaseStudy.tags,
      author: existingCaseStudy.author,
    };

    const caseStudy = await CaseStudy.findByIdAndDelete(param.id).exec();

    // 🔴 LOG ACTIVITY - Case Study Deleted
    const adminEmail = getUserEmailFromRequest(req);
    await logActivity({
      action: "DELETED",
      module: "CASESTUDY",
      admin: adminEmail,
      details: deletedData,
      req,
    });

    res.status(200).json({ message: "Case study deleted successfully", data: caseStudy });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};