import type { Request, Response } from "express";
import Analytics from "./Analytics.ts";
import Blog from "../blogs/Blog.ts";
import CaseStudy from "../casestudy/CaseStudy.ts";
import mongoose, { type Document } from "mongoose";
import {
  getDashboardStatsSchema,
  type GetDashboardStatsDto,
  getResourceAnalyticsSchema,
  type GetResourceAnalyticsDto,
  getTopResourcesSchema,
  type GetTopResourcesDto,
} from "./dto/dashboard.dto.ts";

// Type for the populated resource
type PopulatedResource = Document & {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  [key: string]: any;
};

/**
 * Helper function to populate resource based on resourceType
 */
const populateResource = async (
  resourceType: "blog" | "casestudy",
  resourceId: mongoose.Types.ObjectId | string
): Promise<PopulatedResource | null> => {
  if (resourceType === "blog") {
    return await Blog.findById(resourceId).exec() as PopulatedResource | null;
  } else {
    return await CaseStudy.findById(resourceId).exec() as PopulatedResource | null;
  }
};

/**
 * Get overall dashboard statistics
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const parsed = getDashboardStatsSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        message: "Query parameters do not match the expected schema",
        details: parsed.error.issues,
      });
    }

    const query: GetDashboardStatsDto = parsed.data;

    // Build date filter
    const dateFilter: any = {};
    if (query.startDate) {
      dateFilter.$gte = new Date(query.startDate);
    }
    if (query.endDate) {
      dateFilter.$lte = new Date(query.endDate);
    }

    const matchFilter: any = {};
    if (Object.keys(dateFilter).length > 0) {
      matchFilter.lastViewedAt = dateFilter;
    }
    if (query.resourceType && query.resourceType !== "all") {
      matchFilter.resourceType = query.resourceType;
    }

    // Get blog statistics
    const blogStats = await Analytics.aggregate([
      {
        $match: {
          resourceType: "blog",
          ...matchFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: "$viewCount" },
          totalUniqueViews: { $sum: "$uniqueViewCount" },
          totalResources: { $sum: 1 },
          avgViewsPerResource: { $avg: "$viewCount" },
        },
      },
    ]);

    // Get case study statistics
    const caseStudyStats = await Analytics.aggregate([
      {
        $match: {
          resourceType: "casestudy",
          ...matchFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: "$viewCount" },
          totalUniqueViews: { $sum: "$uniqueViewCount" },
          totalResources: { $sum: 1 },
          avgViewsPerResource: { $avg: "$viewCount" },
        },
      },
    ]);

    // Get total counts from the database
    const totalBlogs = await Blog.countDocuments();
    const totalCaseStudies = await CaseStudy.countDocuments();

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivityDocs = await Analytics.find({
      lastViewedAt: { $gte: thirtyDaysAgo },
    })
      .sort({ lastViewedAt: -1 })
      .limit(10)
      .lean()
      .exec();

    // Manually populate resources
    const recentActivity = await Promise.all(
      recentActivityDocs.map(async (doc) => {
        const resource = await populateResource(
          doc.resourceType as "blog" | "casestudy",
          doc.resourceId
        );
        return {
          ...doc,
          resourceId: resource,
        };
      })
    );

    // Calculate daily trend for last 30 days
    const dailyTrend = await Analytics.aggregate([
      {
        $unwind: "$dailyViews",
      },
      {
        $match: {
          "dailyViews.date": { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            date: "$dailyViews.date",
            resourceType: "$resourceType",
          },
          totalViews: { $sum: "$dailyViews.count" },
        },
      },
      {
        $sort: { "_id.date": 1 },
      },
    ]);

    res.status(200).json({
      overview: {
        blogs: {
          total: totalBlogs,
          totalViews: blogStats[0]?.totalViews || 0,
          totalUniqueViews: blogStats[0]?.totalUniqueViews || 0,
          avgViewsPerBlog:
            Math.round((blogStats[0]?.avgViewsPerResource || 0) * 100) / 100,
          trackedResources: blogStats[0]?.totalResources || 0,
        },
        caseStudies: {
          total: totalCaseStudies,
          totalViews: caseStudyStats[0]?.totalViews || 0,
          totalUniqueViews: caseStudyStats[0]?.totalUniqueViews || 0,
          avgViewsPerCaseStudy:
            Math.round((caseStudyStats[0]?.avgViewsPerResource || 0) * 100) /
            100,
          trackedResources: caseStudyStats[0]?.totalResources || 0,
        },
        combined: {
          totalViews:
            (blogStats[0]?.totalViews || 0) +
            (caseStudyStats[0]?.totalViews || 0),
          totalUniqueViews:
            (blogStats[0]?.totalUniqueViews || 0) +
            (caseStudyStats[0]?.totalUniqueViews || 0),
        },
      },
      recentActivity,
      dailyTrend,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Dashboard stats error:", error.message);
      res.status(500).json({ error: error.message });
    } else {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: "Unknown error occurred" });
    }
  }
};

/**
 * Get analytics for a specific resource (blog or case study)
 */
export const getResourceAnalytics = async (req: Request, res: Response) => {
  try {
    const parsed = getResourceAnalyticsSchema.safeParse({
      resourceType: req.params.resourceType,
      resourceId: req.params.resourceId,
    });

    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        message: "Parameters do not match the expected schema",
        details: parsed.error.issues,
      });
    }

    const { resourceType, resourceId } = parsed.data;

    const analytics = await Analytics.findOne({
      resourceType,
      resourceId,
    })
      .lean()
      .exec();

    if (!analytics) {
      return res.status(404).json({
        error: "Analytics not found",
        message: "No analytics data found for this resource",
      });
    }

    // Manually populate the resource
    const resource = await populateResource(
      analytics.resourceType as "blog" | "casestudy",
      analytics.resourceId
    );

    // Get daily trend for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentDailyViews = analytics.dailyViews.filter(
      (dv: any) => new Date(dv.date) >= thirtyDaysAgo
    );

    // Calculate hourly distribution (for views in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentViews = analytics.views.filter(
      (view: any) => new Date(view.timestamp) >= sevenDaysAgo
    );

    const hourlyDistribution = Array(24).fill(0);
    recentViews.forEach((view: any) => {
      const hour = new Date(view.timestamp).getHours();
      hourlyDistribution[hour]++;
    });

    res.status(200).json({
      resourceType,
      resourceId,
      resource: resource,
      stats: {
        totalViews: analytics.viewCount,
        uniqueViews: analytics.uniqueViewCount,
        lastViewedAt: analytics.lastViewedAt,
        averageViewsPerDay:
          recentDailyViews.length > 0
            ? Math.round(
                (recentDailyViews.reduce((sum: number, dv: any) => sum + dv.count, 0) /
                  recentDailyViews.length) *
                  100
              ) / 100
            : 0,
      },
      dailyTrend: recentDailyViews,
      hourlyDistribution,
      recentViewsCount: recentViews.length,
      totalViewsRecorded: analytics.views.length,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Resource analytics error:", error.message);
      res.status(500).json({ error: error.message });
    } else {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Unknown error occurred" });
    }
  }
};

/**
 * Get top performing resources (blogs or case studies)
 */
export const getTopResources = async (req: Request, res: Response) => {
  try {
    const parsed = getTopResourcesSchema.safeParse({
      resourceType: req.params.resourceType,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
    });

    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        message: "Parameters do not match the expected schema",
        details: parsed.error.issues,
      });
    }

    const { resourceType, limit, sortBy } = parsed.data;
    const sortField = sortBy || "viewCount";
    const limitNum = parseInt(limit);

    const topResourcesDocs = await Analytics.find({ resourceType })
      .sort({ [sortField]: -1 })
      .limit(limitNum)
      .lean()
      .exec();

    // Manually populate resources
    const topResources = await Promise.all(
      topResourcesDocs.map(async (analytics: any) => {
        const resource = await populateResource(
          analytics.resourceType as "blog" | "casestudy",
          analytics.resourceId
        );
        return {
          resource: resource,
          viewCount: analytics.viewCount,
          uniqueViewCount: analytics.uniqueViewCount,
          lastViewedAt: analytics.lastViewedAt,
          dailyAverage:
            analytics.dailyViews.length > 0
              ? Math.round(
                  (analytics.dailyViews.reduce(
                    (sum: number, dv: any) => sum + dv.count,
                    0
                  ) /
                    analytics.dailyViews.length) *
                    100
                ) / 100
              : 0,
        };
      })
    );

    res.status(200).json({
      resourceType,
      count: topResources.length,
      sortBy: sortField,
      data: topResources,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Top resources error:", error.message);
      res.status(500).json({ error: error.message });
    } else {
      console.error("Top resources error:", error);
      res.status(500).json({ error: "Unknown error occurred" });
    }
  }
};

/**
 * Get all analytics records with pagination
 */
export const getAllAnalytics = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const resourceType = req.query.resourceType as string;

    const filter: any = {};
    if (resourceType && resourceType !== "all") {
      filter.resourceType = resourceType;
    }

    const skip = (page - 1) * limit;

    const [analyticsDocs, total] = await Promise.all([
      Analytics.find(filter)
        .sort({ viewCount: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Analytics.countDocuments(filter),
    ]);

    // Manually populate resources
    const analytics = await Promise.all(
      analyticsDocs.map(async (doc: any) => {
        const resource = await populateResource(
          doc.resourceType as "blog" | "casestudy",
          doc.resourceId
        );
        return {
          ...doc,
          resourceId: resource,
        };
      })
    );

    res.status(200).json({
      data: analytics,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Get all analytics error:", error.message);
      res.status(500).json({ error: error.message });
    } else {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Unknown error occurred" });
    }
  }
};

/**
 * NEW: Get aggregated view statistics for ALL Case Studies (Daily, Weekly, Monthly, Yearly)
 */
export const getCaseStudyStats = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);

    const oneMonthAgo = new Date(today);
    oneMonthAgo.setDate(today.getDate() - 30);

    const oneYearAgo = new Date(today);
    oneYearAgo.setDate(today.getDate() - 365);

    const stats = await Analytics.aggregate([
      // 1. Filter only Case Studies
      { $match: { resourceType: "casestudy" } },
      
      // 2. Separate two streams of data: Total Counts vs Temporal Data
      {
        $facet: {
          // Calculate All-time Total directly from viewCount field
          "overall": [
            {
              $group: {
                _id: null,
                totalAllTime: { $sum: "$viewCount" },
                totalUnique: { $sum: "$uniqueViewCount" }
              }
            }
          ],
          // Calculate Time-based stats from dailyViews array
          "periods": [
            { $unwind: "$dailyViews" }, // Deconstruct the array
            {
              $group: {
                _id: null,
                // Daily: Matches strictly today's date
                daily: {
                  $sum: {
                    $cond: [{ $gte: ["$dailyViews.date", today] }, "$dailyViews.count", 0]
                  }
                },
                // Weekly: Last 7 days
                weekly: {
                  $sum: {
                    $cond: [{ $gte: ["$dailyViews.date", oneWeekAgo] }, "$dailyViews.count", 0]
                  }
                },
                // Monthly: Last 30 days
                monthly: {
                  $sum: {
                    $cond: [{ $gte: ["$dailyViews.date", oneMonthAgo] }, "$dailyViews.count", 0]
                  }
                },
                // Yearly: Last 365 days
                yearly: {
                  $sum: {
                    $cond: [{ $gte: ["$dailyViews.date", oneYearAgo] }, "$dailyViews.count", 0]
                  }
                }
              }
            }
          ]
        }
      }
    ]);

    // Format the result cleanly
    const result = {
      totalAllTime: stats[0].overall[0]?.totalAllTime || 0,
      totalUnique: stats[0].overall[0]?.totalUnique || 0,
      daily: stats[0].periods[0]?.daily || 0,
      weekly: stats[0].periods[0]?.weekly || 0,
      monthly: stats[0].periods[0]?.monthly || 0,
      yearly: stats[0].periods[0]?.yearly || 0,
    };

    res.status(200).json(result);

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Case Study Stats error:", error.message);
      res.status(500).json({ error: error.message });
    } else {
      console.error("Case Study Stats error:", error);
      res.status(500).json({ error: "Unknown error occurred" });
    }
  }
};

/**
 * Get comparison between blogs and case studies
 */
export const getComparison = async (req: Request, res: Response) => {
  try {
    const blogAnalytics = await Analytics.aggregate([
      { $match: { resourceType: "blog" } },
      {
        $group: {
          _id: null,
          totalViews: { $sum: "$viewCount" },
          totalUniqueViews: { $sum: "$uniqueViewCount" },
          avgViews: { $avg: "$viewCount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const caseStudyAnalytics = await Analytics.aggregate([
      { $match: { resourceType: "casestudy" } },
      {
        $group: {
          _id: null,
          totalViews: { $sum: "$viewCount" },
          totalUniqueViews: { $sum: "$uniqueViewCount" },
          avgViews: { $avg: "$viewCount" },
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      blogs: blogAnalytics[0] || {
        totalViews: 0,
        totalUniqueViews: 0,
        avgViews: 0,
        count: 0,
      },
      caseStudies: caseStudyAnalytics[0] || {
        totalViews: 0,
        totalUniqueViews: 0,
        avgViews: 0,
        count: 0,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Comparison error:", error.message);
      res.status(500).json({ error: error.message });
    } else {
      console.error("Comparison error:", error);
      res.status(500).json({ error: "Unknown error occurred" });
    }
  }
};