import type { Request, Response } from "express";
import GhlPageView from "./ghl-page-view.model.js";

function verifyGhlWebhookSecret(req: Request): boolean {
  const expected = process.env.GHL_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  const header = req.headers["x-ghl-webhook-secret"];
  const h = typeof header === "string" ? header.trim() : "";
  if (h && h === expected) return true;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t === expected) return true;
  }
  return false;
}

/**
 * POST /api/ghl/pageview — GHL Workflow webhook (no JWT; shared secret).
 */
export const ingestGhlPageView = async (req: Request, res: Response) => {
  try {
    if (!verifyGhlWebhookSecret(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body as Record<string, unknown>;

    const contactId = String(
      body.contact_id ?? body.contactId ?? "unknown"
    ).slice(0, 200);
    const contactName = String(
      body.contact_name ?? body.contactName ?? "Unknown"
    ).slice(0, 300);
    const contactEmail = String(
      body.contact_email ?? body.contactEmail ?? ""
    ).slice(0, 320);
    const pageUrl = String(body.page_url ?? body.pageUrl ?? "").slice(0, 2048);
    const pageVisited = String(
      body.page_visited ?? body.pageVisited ?? pageUrl ?? "Unknown Page"
    ).slice(0, 500);
    const funnelName = String(
      body.funnel_name ?? body.funnelName ?? "Unknown Funnel"
    ).slice(0, 300);
    const utmSource = String(
      body.utm_source ?? body.utmSource ?? ""
    ).slice(0, 200);

    await GhlPageView.create({
      contactId,
      contactName,
      contactEmail,
      pageVisited,
      funnelName,
      pageUrl,
      utmSource,
      viewedAt: new Date(),
    });

    return res.status(201).json({ success: true });
  } catch (e) {
    console.error("ingestGhlPageView:", e);
    return res.status(500).json({ error: "Failed to save" });
  }
};

interface AuthedRequest extends Request {
  user?: { id?: string; role?: number; email?: string };
}

function requireClient(req: AuthedRequest, res: Response): boolean {
  if (Number(req.user?.role) !== 0) {
    res.status(403).json({ error: "Clients only" });
    return false;
  }
  return true;
}

function requireAdmin(req: AuthedRequest, res: Response): boolean {
  if (Number(req.user?.role) !== 1 && Number(req.user?.role) !== 2) {
    res.status(403).json({ error: "Admins only" });
    return false;
  }
  return true;
}

/**
 * GET /api/page-views/funnels - Admin funnel analytics
 */
export const getFunnelsAnalytics = async (
  req: AuthedRequest,
  res: Response
) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { range = "30d" } = req.query;
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const funnelAggregation = await GhlPageView.aggregate([
      {
        $match: {
          viewedAt: { $gte: startDate },
          pageUrl: { $exists: true, $ne: "" }
        }
      },
      {
        $group: {
          _id: "$pageUrl",
          name: { $first: "$funnelName" },
          views: { $sum: 1 },
          unique: { $addToSet: "$contactId" },
          firstView: { $min: "$viewedAt" },
          lastView: { $max: "$viewedAt" }
        }
      },
      {
        $project: {
          url: "$_id",
          name: { $ifNull: ["$name", "Unknown Funnel"] },
          views: 1,
          uniqueCount: { $size: "$unique" },
          conversions: {
            $size: {
              $filter: {
                input: "$unique",
                cond: { $ne: ["$$this", "unknown"] }
              }
            }
          },
          convRate: {
            $multiply: [
              {
                $divide: [
                  {
                    $size: {
                      $filter: {
                        input: "$unique",
                        cond: { $ne: ["$$this", "unknown"] }
                      }
                    }
                  },
                  { $size: "$unique" }
                ]
              },
              100
            ]
          },
          firstView: 1,
          lastView: 1
        }
      },
      { $sort: { views: -1 } }
    ]);

    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - days);

    const previousAggregation = await GhlPageView.aggregate([
      {
        $match: {
          viewedAt: { $gte: previousStartDate, $lt: startDate },
          pageUrl: { $exists: true, $ne: "" }
        }
      },
      {
        $group: {
          _id: "$pageUrl",
          views: { $sum: 1 }
        }
      }
    ]);

    const previousViews = previousAggregation.reduce(
      (acc: Record<string, number>, item: { _id: string; views: number }) => {
        acc[item._id] = item.views;
        return acc;
      },
      {}
    );

    const colors = ["#4F46E5", "#0D9488", "#7C3AED", "#F59E0B", "#EC4899"];
    const funnels = funnelAggregation.map((funnel: any, index: number) => {
      const previousViewsCount = previousViews[funnel.url] || 0;
      const change =
        previousViewsCount > 0
          ? Math.round(
              ((funnel.views - previousViewsCount) / previousViewsCount) * 100
            )
          : 0;

      return {
        name: funnel.name,
        url: funnel.url,
        views: funnel.views,
        unique: funnel.uniqueCount,
        conversions: funnel.conversions,
        convRate: Number(funnel.convRate.toFixed(2)),
        change,
        color: colors[index % colors.length]
      };
    });

    return res.status(200).json({ funnels });
  } catch (e) {
    console.error("getFunnelsAnalytics:", e);
    return res.status(500).json({ error: "Failed to load funnel analytics" });
  }
};

/**
 * GET /api/page-views/funnels/:pageUrl - Individual funnel time series data
 */
export const getFunnelDetailAnalytics = async (
  req: AuthedRequest,
  res: Response
) => {
  try {
    if (!requireAdmin(req, res)) return;

    const rawParam = req.params["pageUrl"];
    const rawUrl = Array.isArray(rawParam) ? rawParam[0] : rawParam;
    if (!rawUrl) {
      return res.status(400).json({ error: "url param is required" });
    }

    const pageUrl = decodeURIComponent(rawUrl);

    const { range = "30d" } = req.query;
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyData = await GhlPageView.aggregate([
      {
        $match: {
          pageUrl,
          viewedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$viewedAt"
            }
          },
          views: { $sum: 1 },
          unique: { $addToSet: "$contactId" }
        }
      },
      {
        $project: {
          date: "$_id",
          views: 1,
          unique: { $size: "$unique" },
          conversions: {
            $size: {
              $filter: {
                input: "$unique",
                cond: { $ne: ["$$this", "unknown"] }
              }
            }
          }
        }
      },
      { $sort: { date: 1 } }
    ]);

    const totals = dailyData.reduce(
      (
        acc: { views: number; unique: number; conversions: number },
        day: any
      ) => ({
        views: acc.views + day.views,
        unique: acc.unique + day.unique,
        conversions: acc.conversions + day.conversions
      }),
      { views: 0, unique: 0, conversions: 0 }
    );

    return res.status(200).json({
      daily: dailyData.map((day: any) => ({
        date: new Date(day.date).toLocaleDateString("en", {
          month: "short",
          day: "numeric"
        }),
        views: day.views,
        unique: day.unique,
        conversions: day.conversions
      })),
      totals
    });
  } catch (e) {
    console.error("getFunnelDetailAnalytics:", e);
    return res.status(500).json({ error: "Failed to load funnel detail analytics" });
  }
};

/**
 * GET /api/client/ghl-funnel-analytics/dashboard — logged-in client only.
 */
export const getGhlFunnelClientDashboard = async (
  req: AuthedRequest,
  res: Response
) => {
  try {
    if (!requireClient(req, res)) return;

    const [totalViews, pageViews, uniqueIds, checkoutViews, pageBreakdown] =
      await Promise.all([
        GhlPageView.countDocuments(),
        GhlPageView.find()
          .sort({ viewedAt: -1 })
          .limit(50)
          .lean()
          .exec(),
        (GhlPageView.distinct as (field: string) => Promise<string[]>)(
          "contactId"
        ),
        GhlPageView.countDocuments({
          pageVisited: { $regex: /checkout/i }
        }),
        GhlPageView.aggregate<{ _id: string; count: number }>([
          { $group: { _id: "$pageVisited", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 30 }
        ])
      ]);

    const recentActivity = pageViews.slice(0, 20).map((d: any) => ({
      id: String(d._id),
      contactName: d.contactName,
      contactEmail: d.contactEmail,
      pageVisited: d.pageVisited,
      funnelName: d.funnelName,
      pageUrl: d.pageUrl,
      viewedAt: d.viewedAt
    }));

    return res.status(200).json({
      totalViews,
      uniqueContacts: uniqueIds.length,
      checkoutViews,
      recentActivity,
      pageBreakdown: pageBreakdown.map((p: { _id: string; count: number }) => ({
        page: p._id || "(empty)",
        count: p.count
      }))
    });
  } catch (e) {
    console.error("getGhlFunnelClientDashboard:", e);
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
};