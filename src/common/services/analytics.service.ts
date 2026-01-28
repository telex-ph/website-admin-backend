import Analytics from "../../dashboard/Analytics.ts";
import type { Request } from "express";

interface TrackViewParams {
  resourceType: "blog" | "casestudy";
  resourceId: string;
  req: Request;
}

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