import type { Request, Response } from "express";
import CaseStudy from "./CaseStudy.ts";
import { toSlug } from "../common/utils/to-slug.util.ts";
import {
  getParamSchema,
  type GetParamDto,
} from "../common/dto/get-param.dto.ts";
import uploadFile from "../common/utils/upload-file.util.ts";
import { trackView } from "../common/services/analytics.service.ts";

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

  return {
    title: body.title,
    status: body.status,
    tags,
    sections,
    challenge,
    solution,
  };
};

// Adding case study
export const addCaseStudy = async (req: Request, res: Response) => {
  console.log("\n🚀 ===== CREATE CASE STUDY REQUEST =====");
  
  try {
    // Get authenticated user ID
    const userId = getUserId(req);
    
    if (!userId) {
      console.error("⚠️ No user ID found - returning 401");
      return res.status(401).json({ 
        error: "User not authenticated",
        debug: {
          message: "User ID not found in request",
          userObject: (req as any).user,
          hint: "Check your JWT middleware. The user object should contain id, _id, userId, or sub property"
        }
      });
    }

    // Parse form data
    const parsedData = parseFormData(req.body);
    console.log("📋 Parsed data:", {
      title: parsedData.title,
      status: parsedData.status,
      sectionsCount: parsedData.sections.length,
      challengeCount: parsedData.challenge.length,
      solutionCount: parsedData.solution.length
    });

    // Validate required fields
    if (!parsedData.title) {
      return res.status(400).json({ error: "Title is required" });
    }
    if (!parsedData.status) {
      return res.status(400).json({ error: "Status is required" });
    }
    if (parsedData.sections.length !== 5) {
      return res.status(400).json({ 
        error: "Exactly 5 content sections are required",
        received: parsedData.sections.length,
        hint: "Make sure you have subtitle0-text0 through subtitle4-text4"
      });
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

    // Create case study object
    console.log("💾 Creating case study in database...");
    const newCaseStudy = await CaseStudy.create({
      title: parsedData.title,
      slug: toSlug(parsedData.title),
      cover: url,
      status: parsedData.status,
      tags: parsedData.tags,
      author: userId,
      sections: parsedData.sections,
      challenge: parsedData.challenge,
      solution: parsedData.solution,
    });

    // Populate author information
    await newCaseStudy.populate("author", "name email");
    
    console.log("✅ Case study created successfully!");
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
      .populate("author", "name email")
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
      .populate("author", "name email")
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
      .populate("author", "name email")
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

// Updating case study
export const updateCaseStudy = async (req: Request, res: Response) => {
  const parsedParams = getParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  const param: GetParamDto = parsedParams.data;

  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ 
        error: "User not authenticated",
        debug: "User ID not found in request"
      });
    }

    const existingCaseStudy = await CaseStudy.findById(param.id);
    if (!existingCaseStudy) {
      return res.status(404).json({ error: "Case study not found" });
    }

    if (existingCaseStudy.author.toString() !== userId) {
      return res.status(403).json({ error: "You can only update your own case studies" });
    }

    const parsedData = parseFormData(req.body);
    const updateData: any = {};

    if (parsedData.title) {
      updateData.title = parsedData.title;
      updateData.slug = toSlug(parsedData.title);
    }
    if (parsedData.status) updateData.status = parsedData.status;
    if (parsedData.tags.length > 0) updateData.tags = parsedData.tags;
    if (parsedData.sections.length > 0) {
      if (parsedData.sections.length !== 5) {
        return res.status(400).json({ 
          error: "Exactly 5 content sections are required",
          received: parsedData.sections.length 
        });
      }
      updateData.sections = parsedData.sections;
    }
    if (parsedData.challenge.length > 0) updateData.challenge = parsedData.challenge;
    if (parsedData.solution.length > 0) updateData.solution = parsedData.solution;

    const caseStudy = await CaseStudy.findByIdAndUpdate(param.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("author", "name email")
      .exec();

    res.status(200).json(caseStudy);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
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
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ 
        error: "User not authenticated",
        debug: "User ID not found in request"
      });
    }

    const existingCaseStudy = await CaseStudy.findById(param.id);
    if (!existingCaseStudy) {
      return res.status(404).json({ error: "Case study not found" });
    }

    if (existingCaseStudy.author.toString() !== userId) {
      return res.status(403).json({ error: "You can only delete your own case studies" });
    }

    const caseStudy = await CaseStudy.findByIdAndDelete(param.id).exec();
    res.status(200).json({ message: "Case study deleted successfully", data: caseStudy });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};