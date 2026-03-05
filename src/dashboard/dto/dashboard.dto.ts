import z from "zod";

export const getDashboardStatsSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  resourceType: z.enum(["blog", "casestudy", "all"]).optional(),
});

export type GetDashboardStatsDto = z.infer<typeof getDashboardStatsSchema>;

export const getResourceAnalyticsSchema = z.object({
  resourceType: z.enum(["blog", "casestudy"]),
  resourceId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"),
});

export type GetResourceAnalyticsDto = z.infer<
  typeof getResourceAnalyticsSchema
>;

export const getTopResourcesSchema = z.object({
  resourceType: z.enum(["blog", "casestudy"]),
  limit: z.string().optional().default("10"),
  sortBy: z.enum(["viewCount", "uniqueViewCount", "lastViewedAt"]).optional(),
});

export type GetTopResourcesDto = z.infer<typeof getTopResourcesSchema>;

// ── Engagement Metrics ────────────────────────────────────────────────────────
// startDate / endDate are ISO datetime strings sent by the frontend.
// The controller uses the range size to auto-select grouping granularity:
//   <= 1 day   -> hourly  (24 data points)
//   <= 31 days -> daily   (N data points, one per day)
//   > 31 days  -> monthly (one per calendar month)
export const getEngagementMetricsSchema = z.object({
  resourceType: z.enum(["blog", "casestudy", "all"]).optional().default("all"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type GetEngagementMetricsDto = z.infer<typeof getEngagementMetricsSchema>;