import Analytics from "../../dashboard/Analytics.js";
import SitePageView from "../../site-page-views/site-page-view.model.js";
import type { Request } from "express";

interface TrackViewParams {
  resourceType: "blog" | "casestudy";
  resourceId: string;
  req: Request;
  resourceTitle?: string; // ✅ ADDED: optional, used by casestudy controller
}

interface TrackSitePageViewParams {
  path: string;
  sessionId: string;
  req: Request;
  kind?: "page" | "funnel";
  referrer?: string;
  funnelLabel?: string;
}

/**
 * Track a general site page view
 */
export const trackSitePageView = async ({
  path,
  sessionId,
  req,
  kind = "page",
  referrer,
  funnelLabel,
}: TrackSitePageViewParams) => {
  try {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "";
    const userAgent = String(req.headers["user-agent"] || "").slice(0, 1024);

    return await SitePageView.create({
      path,
      referrer: referrer || "",
      userAgent,
      ip,
      sessionId,
      kind,
      funnelLabel: kind === "funnel" ? funnelLabel : "",
      visitedAt: new Date(),
    });
  } catch (error) {
    console.error("Error tracking site page view:", error);
    throw error;
  }
};

/**
 * Track a view for a blog or case study
 */
export const trackView = async ({
  resourceType,
  resourceId,
  req,
}: TrackViewParams) => {
  try {
    const ipAddress =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      req.socket.remoteAddress ||
      "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    const userId = (req as any).user?.id || null; // From JWT if authenticated

    // Get today's date at midnight for daily tracking
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find or create analytics record
    let analytics = await Analytics.findOne({
      resourceType,
      resourceId,
    });

    if (!analytics) {
      // Create new analytics record
      analytics = await Analytics.create({
        resourceType,
        resourceId,
        viewCount: 1,
        uniqueViewCount: 1,
        views: [
          {
            ipAddress,
            userAgent,
            timestamp: new Date(),
            userId,
          },
        ],
        dailyViews: [
          {
            date: today,
            count: 1,
          },
        ],
        lastViewedAt: new Date(),
      });
    } else {
      // Update existing analytics
      const isUniqueView = !analytics.views.some(
        (view) =>
          view.ipAddress === ipAddress &&
          view.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000 // Within last 24 hours
      );

      // Add new view
      analytics.views.push({
        ipAddress,
        userAgent,
        timestamp: new Date(),
        userId,
      });

      // Increment view count
      analytics.viewCount += 1;

      // Increment unique view count if unique
      if (isUniqueView) {
        analytics.uniqueViewCount += 1;
      }

      // Update daily views
      const todayView = analytics.dailyViews.find(
        (dv) => dv.date.getTime() === today.getTime()
      );

      if (todayView) {
        todayView.count += 1;
      } else {
        analytics.dailyViews.push({
          date: today,
          count: 1,
        });
      }

      // Update last viewed timestamp
      analytics.lastViewedAt = new Date();

      // Save analytics
      await analytics.save();
    }

    return analytics;
  } catch (error) {
    console.error("Error tracking view:", error);
    throw error;
  }
};

/**
 * Get analytics for a specific resource
 */
export const getResourceAnalytics = async (
  resourceType: "blog" | "casestudy",
  resourceId: string
) => {
  try {
    const analytics = await Analytics.findOne({
      resourceType,
      resourceId,
    });

    return analytics;
  } catch (error) {
    console.error("Error fetching resource analytics:", error);
    throw error;
  }
};

/**
 * Get overall site page view statistics
 */
export const getSitePageViewStats = async (startDate?: Date, endDate?: Date) => {
  try {
    const filter: any = {};
    if (startDate || endDate) {
      filter.visitedAt = {};
      if (startDate) filter.visitedAt.$gte = startDate;
      if (endDate) filter.visitedAt.$lte = endDate;
    }

    const stats = await SitePageView.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalViews: { $sum: 1 },
          uniqueVisitors: { $addToSet: "$sessionId" },
        },
      },
      {
        $project: {
          totalViews: 1,
          uniqueVisitorsCount: { $size: "$uniqueVisitors" },
        },
      },
    ]);

    return stats[0] || { totalViews: 0, uniqueVisitorsCount: 0 };
  } catch (error) {
    console.error("Error fetching site page view stats:", error);
    throw error;
  }
};

/**
 * Get top pages by view count
 */
export const getTopPages = async (limit: number = 10, startDate?: Date, endDate?: Date) => {
  try {
    const filter: any = {};
    if (startDate || endDate) {
      filter.visitedAt = {};
      if (startDate) filter.visitedAt.$gte = startDate;
      if (endDate) filter.visitedAt.$lte = endDate;
    }

    return await SitePageView.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$path",
          viewCount: { $sum: 1 },
          uniqueVisitors: { $addToSet: "$sessionId" },
        },
      },
      {
        $project: {
          path: "$_id",
          viewCount: 1,
          uniqueVisitorsCount: { $size: "$uniqueVisitors" },
        },
      },
      { $sort: { viewCount: -1 } },
      { $limit: limit },
    ]);
  } catch (error) {
    console.error("Error fetching top pages:", error);
    throw error;
  }
};
