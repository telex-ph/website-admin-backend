import type { Request, Response } from "express";
import CaseStudy from "./CaseStudy.ts";
import {
  createCaseStudySchema,
  type CreateCaseStudyDto,
} from "./dto/create-casestudy.dto.ts";
import { toSlug } from "../common/utils/to-slug.util.ts";
import {
  getParamSchema,
  type GetParamDto,
} from "../common/dto/get-param.dto.ts";
import {
  updateCaseStudySchema,
  type UpdateCaseStudyDto,
} from "./dto/update-casestudy.dto.ts";
import { Types } from "mongoose";
import uploadFile from "../common/utils/upload-file.util.ts";

// Adding case study
export const addCaseStudy = async (req: Request, res: Response) => {
  // Check the body using Zod/validation
  const parsed = createCaseStudySchema.safeParse(req.body);

  // Validate
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body does not match the expected schema",
      details: parsed.error.issues,
    });
  }

  const caseStudy: CreateCaseStudyDto = parsed.data;

  try {
    // File uploading
    const file = req.file;
    if (!file?.buffer) throw new Error("File buffer is empty");
    const url = await uploadFile(file);

    // Create case study object
    const newCaseStudy = await CaseStudy.create({
      title: caseStudy.title,
      slug: toSlug(caseStudy.title),
      content: caseStudy.content,
      client: caseStudy.client,
      industry: caseStudy.industry,
      challenge: caseStudy.challenge,
      solution: caseStudy.solution,
      results: caseStudy.results,
      author: Types.ObjectId.createFromHexString(caseStudy.author),
      status: caseStudy.status,
      cover: url,
    });

    res.status(201).json(newCaseStudy);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Adding case study error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Case study error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Fetching all case studies with advanced filtering
export const getAllCaseStudies = async (req: Request, res: Response) => {
  try {
    // Extract query parameters
    const { search, client, industry, status, author } = req.query;

    // Build dynamic filter object
    const filter: any = {};

    // Search in title, content, challenge, solution, or results
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
        { challenge: { $regex: search, $options: "i" } },
        { solution: { $regex: search, $options: "i" } },
        { results: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by client
    if (client) {
      filter.client = { $regex: client, $options: "i" };
    }

    // Filter by industry
    if (industry) {
      filter.industry = { $regex: industry, $options: "i" };
    }

    // Filter by status
    if (status) {
      filter.status = status;
    }

    // Filter by author
    if (author) {
      filter.author = author;
    }

    const caseStudies = await CaseStudy.find(filter)
      .populate("author", "name email")
      .exec();
    res.status(200).json(caseStudies);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching case studies error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Case studies error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Fetching single case study
export const getCaseStudy = async (req: Request, res: Response) => {
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
    const caseStudy = await CaseStudy.findById(param.id)
      .populate("author", "name email")
      .exec();

    if (!caseStudy) {
      return res.status(404).json({ error: "Case study not found" });
    }

    res.status(200).json(caseStudy);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching case study error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Case study error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Fetching single case study by slug
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

    res.status(200).json(caseStudy);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Fetching case study by slug error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Case study error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Updating case study
export const updateCaseStudy = async (req: Request, res: Response) => {
  // Validate the params
  const parsedParams = getParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request parameters do not match the expected schema",
    });
  }

  // Validate the body
  const parsedBody = updateCaseStudySchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Validation failed",
      message: "Request body does not match the expected schema",
      details: parsedBody.error.issues,
    });
  }

  const param: GetParamDto = parsedParams.data;
  const body: UpdateCaseStudyDto = parsedBody.data;

  try {
    // If title is being updated, regenerate slug
    const updateData = body.title
      ? { ...body, slug: toSlug(body.title) }
      : body;

    // Search for the id and update
    const caseStudy = await CaseStudy.findByIdAndUpdate(param.id, updateData, {
      new: true,
      runValidators: true,
    }).exec();

    if (!caseStudy) {
      return res.status(404).json({ error: "Case study not found" });
    }

    res.status(200).json(caseStudy);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Updating case study error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Case study error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};

// Deleting case study
export const deleteCaseStudy = async (req: Request, res: Response) => {
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
    // Search for the id and delete
    const caseStudy = await CaseStudy.findByIdAndDelete(param.id).exec();

    if (!caseStudy) {
      return res.status(404).json({ error: "Case study not found" });
    }

    res
      .status(200)
      .json({ message: "Case study deleted successfully", data: caseStudy });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Deleting case study error:", error.message);
      res.status(400).json({ error: error.message });
    } else {
      console.error("Case study error:", error);
      res.status(400).json({ error: "Unknown error occurred" });
    }
  }
};
