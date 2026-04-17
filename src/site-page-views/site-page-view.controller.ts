import type { Request, Response } from "express";
import SitePageView from "./site-page-view.model.js";
import { resolvePageMeta } from "./site-page-view.meta.js";

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

const SOURCE_COLORS: Record<string, string> = {
  "Organic Search": "#378ADD",
  Direct: "#1D9E75",
  Social: "#7F77DD",
  Referral: "#EF9F27",
  Email: "#D85A30",
  Other: "#94a3b8",
};

const FUNNEL_COLORS = [
  "#378ADD", "#7F77DD", "#1D9E75", "#EF9F27", "#D85A30", "#60B4F0",
];

function deviceType(ua: string): "Desktop" | "Mobile" | "Tablet" {
  const s = ua || "";
  if (/tablet|ipad|playbook|silk/i.test(s)) return "Tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(s))
    return "Mobile";
  return "Desktop";
}

function trafficSource(referrer: string, siteHost: string): string {
  const ref = (referrer || "").trim();
  if (!ref) return "Direct";
  let url: URL;
  try {
    url = new URL(ref);
  } catch {
    return "Other";
  }
  const h = url.hostname.toLowerCase();
  const site = siteHost.toLowerCase().replace(/^www\./, "");
  if (site && (h === site || h === `www.${site}` || h.endsWith(`.${site}`)))
    return "Direct";
  if (/google\.|bing\.|duckduckgo\.|yahoo\.|yandex\.|baidu\./i.test(h))
    return "Organic Search";
  if (
    /facebook|fb\.|twitter|t\.co|instagram|linkedin|tiktok|pinterest|reddit/i.test(h)
  )
    return "Social";
  if (url.searchParams.get("utm_medium")?.toLowerCase() === "email")
    return "Email";
  if (/mail\.|email\.|newsletter/i.test(h)) return "Email";
  return "Referral";
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function pctChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function isFunnelPath(path: string, kind: string): boolean {
  if (kind === "funnel") return true;
  const p = path.toLowerCase();
  return p.includes("gohighlevel.com") || p.includes("ghl");
}

function funnelDisplayName(path: string): string {
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      const u = new URL(path);
      const parts = u.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1] || u.hostname;
      return last.length > 3 ? last.slice(0, 48) : `${u.hostname}${u.pathname}`.slice(0, 60);
    }
  } catch {
    /* ignore */
  }
  return path.slice(0, 80);
}

/**
 * Public: record a page or external funnel view from the marketing site.
 */
export const trackSitePageView = async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      path?: string;
      referrer?: string;
      sessionId?: string;
      kind?: string;
      funnelLabel?: string;
      email?: string;
    };
    const pagePath = typeof body.path === "string" ? body.path.trim() : "";
    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!pagePath || !sessionId) {
      return res.status(400).json({ error: "path and sessionId are required" });
    }
    if (pagePath.length > 2048 || sessionId.length > 200 || email.length > 200) {
      return res.status(400).json({ error: "payload too large" });
    }

    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "";
    const userAgent = String(req.headers["user-agent"] || "").slice(0, 1024);
    const referrer = String(body.referrer || "").slice(0, 2048);
    const kind = body.kind === "funnel" ? "funnel" : "page";
    const rawLabel =
      typeof body.funnelLabel === "string" ? body.funnelLabel.trim() : "";
    const funnelLabel =
      rawLabel.length > 120 ? rawLabel.slice(0, 120) : rawLabel;

    await SitePageView.create({
      path: pagePath,
      referrer,
      userAgent,
      ip,
      sessionId,
      kind,
      funnelLabel: kind === "funnel" ? funnelLabel : "",
      email,
      visitedAt: new Date(),
    });

    res.status(201).json({ ok: true });
  } catch (e) {
    console.error("trackSitePageView:", e);
    res.status(500).json({ error: "Failed to record view" });
  }
};

async function viewsInRange(start: Date, end: Date, extraMatch: Record<string, unknown> = {}) {
  return SitePageView.find({
    visitedAt: { $gte: start, $lte: end },
    ...extraMatch,
  } as any)
    .lean()
    .exec();
}

function buildDailyLabels(
  start: Date,
  end: Date,
  days: number
): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const MONTH_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const cur = startOfUtcDay(start);
  const endDay = startOfUtcDay(end);
  while (cur <= endDay) {
    const key = cur.toISOString().slice(0, 10);
    const label =
      days <= 7
        ? `${DAY_SHORT[cur.getUTCDay()]} ${cur.getUTCDate()}`
        : `${MONTH_SHORT[cur.getUTCMonth()]} ${cur.getUTCDate()}`;
    out.push({ key, label });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * Admin dashboard — aggregated analytics for Page Views UI.
 */
export const getPageViewsOverview = async (req: Request, res: Response) => {
  try {
    const rangeParam = String(req.query.range || "30d");
    const days = RANGE_DAYS[rangeParam] ?? 30;
    const siteHost = (process.env.FRONTEND_SITE_HOST || "telexph.com")
      .replace(/^https?:\/\//, "")
      .split("/")[0] || "telexph.com";

    const end = new Date();
    const start = addDays(startOfUtcDay(end), -(days - 1));
    const prevEnd = addDays(start, -1);
    const prevStart = addDays(startOfUtcDay(prevEnd), -(days - 1));

    const [currentDocs, prevDocs] = await Promise.all([
      viewsInRange(start, end),
      viewsInRange(prevStart, prevEnd),
    ]);

    const dailySlots = buildDailyLabels(start, end, days);
    const dailyMap = new Map<string, { views: number; unique: Set<string> }>();
    for (const s of dailySlots) {
      dailyMap.set(s.key, { views: 0, unique: new Set() });
    }

    const sourceCount = new Map<string, number>();
    const deviceCount = new Map<string, number>();
    const pathCount = new Map<string, number>();
    const sessionIds = new Set<string>();
    const sessionDayPairs = new Set<string>();
    const viewsBySession = new Map<string, number>();

    for (const d of currentDocs) {
      const dayKey = new Date(d.visitedAt).toISOString().slice(0, 10);
      const bucket = dailyMap.get(dayKey);
      if (bucket) {
        bucket.views += 1;
        bucket.unique.add(d.sessionId);
      }
      sessionIds.add(d.sessionId);
      sessionDayPairs.add(`${d.sessionId}|${dayKey}`);
      viewsBySession.set(d.sessionId, (viewsBySession.get(d.sessionId) || 0) + 1);

      const src = trafficSource(d.referrer || "", siteHost);
      sourceCount.set(src, (sourceCount.get(src) || 0) + 1);
      const dev = deviceType(d.userAgent || "");
      deviceCount.set(dev, (deviceCount.get(dev) || 0) + 1);

      if (d.kind === "page" && !isFunnelPath(d.path, d.kind)) {
        const meta = resolvePageMeta(d.path);
        const key = meta.page;
        pathCount.set(key, (pathCount.get(key) || 0) + 1);
      }
    }

    const prevPathCount = new Map<string, number>();
    for (const d of prevDocs) {
      if (d.kind === "page" && !isFunnelPath(d.path, d.kind)) {
        const meta = resolvePageMeta(d.path);
        prevPathCount.set(meta.page, (prevPathCount.get(meta.page) || 0) + 1);
      }
    }

    let bounceSessions = 0;
    for (const [, cnt] of viewsBySession) {
      if (cnt === 1) bounceSessions += 1;
    }
    const totalSessions = viewsBySession.size || 1;
    const bounceRate = Math.round((bounceSessions / totalSessions) * 1000) / 10;

    const totalViews = currentDocs.length;
    const uniqueVisitors = sessionIds.size;
    const sessionVisits = sessionDayPairs.size;
    const avgPagesPerVisit =
      uniqueVisitors > 0 ? Math.round((totalViews / uniqueVisitors) * 10) / 10 : 0;

    const prevViews = prevDocs.length;
    const prevSessionIds = new Set(prevDocs.map((d) => d.sessionId));
    const prevUnique = prevSessionIds.size;

    const prevViewsBySession = new Map<string, number>();
    for (const d of prevDocs) {
      prevViewsBySession.set(d.sessionId, (prevViewsBySession.get(d.sessionId) || 0) + 1);
    }
    let prevBounceSessions = 0;
    for (const [, cnt] of prevViewsBySession) {
      if (cnt === 1) prevBounceSessions += 1;
    }
    const prevTotalSessions = prevViewsBySession.size || 1;
    const prevBounceRate =
      Math.round((prevBounceSessions / prevTotalSessions) * 1000) / 10;

    const daily = dailySlots.map(({ key, label }) => {
      const b = dailyMap.get(key)!;
      return {
        date: label,
        dateKey: key,
        views: b.views,
        unique: b.unique.size,
        sessions: b.unique.size,
      };
    });

    const topPages: Array<{
      page: string;
      label: string;
      section: string;
      views: number;
      change: number;
    }> = [];
    for (const [p, cnt] of pathCount.entries()) {
      const meta = resolvePageMeta(p);
      const prev = prevPathCount.get(p) || 0;
      topPages.push({
        page: meta.page,
        label: meta.label,
        section: meta.section,
        views: cnt,
        change: pctChange(cnt, prev),
      });
    }
    topPages.sort((a, b) => b.views - a.views);

    const sourceTotal = totalViews || 1;
    const trafficSources = Array.from(sourceCount.entries())
      .map(([name, value]) => ({
        name,
        value: Math.round((value / sourceTotal) * 1000) / 10,
        color: SOURCE_COLORS[name] || SOURCE_COLORS["Other"]!,
      }))
      .sort((a, b) => b.value - a.value);

    const devices = ["Desktop", "Mobile", "Tablet"].map((device) => ({
      device,
      views: deviceCount.get(device) || 0,
    }));

    const funnelMap = new Map<string, { views: number; unique: Set<string> }>();
    const funnelLabelByPath = new Map<string, string>();
    for (const d of currentDocs) {
      if (!isFunnelPath(d.path, d.kind)) continue;
      const key = d.path;
      if (!funnelMap.has(key)) {
        funnelMap.set(key, { views: 0, unique: new Set() });
      }
      const f = funnelMap.get(key)!;
      f.views += 1;
      f.unique.add(d.sessionId);
      const doc = d as any;
      if (
        !funnelLabelByPath.has(key) &&
        typeof doc.funnelLabel === "string" &&
        doc.funnelLabel.trim().length > 0
      ) {
        funnelLabelByPath.set(key, doc.funnelLabel.trim().slice(0, 120));
      }
    }

    const prevFunnelMap = new Map<string, number>();
    for (const d of prevDocs) {
      if (!isFunnelPath(d.path, d.kind)) continue;
      prevFunnelMap.set(d.path, (prevFunnelMap.get(d.path) || 0) + 1);
    }

    const funnels = Array.from(funnelMap.entries())
      .map(([url, agg], i) => {
        const prev = prevFunnelMap.get(url) || 0;
        const unique = agg.unique.size;
        return {
          name: funnelLabelByPath.get(url) || funnelDisplayName(url),
          url,
          views: agg.views,
          unique,
          conversions: 0,
          convRate: 0,
          change: pctChange(agg.views, prev),
          color: FUNNEL_COLORS[i % FUNNEL_COLORS.length]!,
        };
      })
      .sort((a, b) => b.views - a.views);

    res.status(200).json({
      range: rangeParam,
      daily,
      totals: {
        views: totalViews,
        uniqueVisitors,
        sessions: sessionVisits,
        avgPagesPerVisit,
        bounceRate,
      },
      changes: {
        views: pctChange(totalViews, prevViews),
        unique: pctChange(uniqueVisitors, prevUnique),
        sessions: pctChange(
          sessionVisits,
          (() => {
            const ps = new Set<string>();
            for (const d of prevDocs) {
              const dayKey = new Date(d.visitedAt).toISOString().slice(0, 10);
              ps.add(`${d.sessionId}|${dayKey}`);
            }
            return ps.size;
          })()
        ),
        bounceRate: pctChange(bounceRate, prevBounceRate),
      },
      topPages: topPages.slice(0, 50),
      trafficSources,
      devices,
      funnels,
    });
  } catch (e) {
    console.error("getPageViewsOverview:", e);
    res.status(500).json({ error: "Failed to load page view analytics" });
  }
};

/**
 * Daily series for one funnel URL (or path).
 */
export const getPageViewsSeries = async (req: Request, res: Response) => {
  try {
    const pathParam = req.query.path as string;
    if (!pathParam) {
      return res.status(400).json({ error: "path query required" });
    }
    const targetPath = decodeURIComponent(pathParam);
    const rangeParam = String(req.query.range || "30d");
    const days = RANGE_DAYS[rangeParam] ?? 30;

    const end = new Date();
    const start = addDays(startOfUtcDay(end), -(days - 1));

    const docs = await SitePageView.find({
      path: targetPath,
      visitedAt: { $gte: start, $lte: end },
    } as any)
      .lean()
      .exec();

    const dailySlots = buildDailyLabels(start, end, days);
    const dailyMap = new Map<string, { views: number; unique: Set<string> }>();
    for (const s of dailySlots) {
      dailyMap.set(s.key, { views: 0, unique: new Set() });
    }

    for (const d of docs) {
      const dayKey = new Date(d.visitedAt).toISOString().slice(0, 10);
      const b = dailyMap.get(dayKey);
      if (b) {
        b.views += 1;
        b.unique.add(d.sessionId);
      }
    }

    const daily = dailySlots.map(({ key, label }) => {
      const b = dailyMap.get(key)!;
      return {
        date: label,
        dateKey: key,
        views: b.views,
        unique: b.unique.size,
        conversions: 0,
      };
    });

    const totals = {
      views: docs.length,
      unique: new Set(docs.map((d) => d.sessionId)).size,
      conversions: 0,
    };

    res.status(200).json({ daily, totals });
  } catch (e) {
    console.error("getPageViewsSeries:", e);
    res.status(500).json({ error: "Failed to load series" });
  }
};

const STAGE_COLORS: Record<string, string> = {
  Awareness: "#8B5CF6",
  Consideration: "#F59E0B",
  Decision: "#10B981",
  Converted: "#3B82F6",
};

function inferStage(
  visits: number,
  pages: number
): "Awareness" | "Consideration" | "Decision" | "Converted" | null {
  if (visits >= 10 && pages >= 10) return "Converted";
  if (visits >= 5 || pages >= 6) return "Decision";
  if (visits >= 2 || pages >= 3) return "Consideration";
  if (visits >= 1) return "Awareness";
  return null;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/**
 * Admin: list recent unique visitors with their journey stage.
 */
export const getVisitorJourney = async (req: Request, res: Response) => {
  try {
    const rangeParam = String(req.query.range || "30d");
    const days = RANGE_DAYS[rangeParam] ?? 30;
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const end = new Date();
    const start = addDays(startOfUtcDay(end), -(days - 1));

    const docs = await SitePageView.find({
      visitedAt: { $gte: start, $lte: end },
    } as any)
      .sort({ visitedAt: -1 })
      .lean()
      .exec();

    const sessionMap = new Map<
      string,
      {
        firstSeen: Date;
        lastSeen: Date;
        visits: number;
        paths: Set<string>;
        entryPage: string;
        colorIdx: number;
        email?: string;
      }
    >();

    let colorIdx = 0;
    for (const d of docs) {
      if (!sessionMap.has(d.sessionId)) {
        sessionMap.set(d.sessionId, {
          firstSeen: new Date(d.visitedAt),
          lastSeen: new Date(d.visitedAt),
          visits: 0,
          paths: new Set(),
          entryPage: d.path,
          colorIdx: colorIdx++ % 5,
        });
      }
      const s = sessionMap.get(d.sessionId)!;
      s.visits += 1;
      s.paths.add(d.path);
      if (new Date(d.visitedAt) > s.lastSeen) s.lastSeen = new Date(d.visitedAt);
      if (new Date(d.visitedAt) < s.firstSeen) s.firstSeen = new Date(d.visitedAt);
      if (!s.email && (d as any).email) s.email = (d as any).email;
    }

    const COLORS_LIST = ["#6366F1", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"];

    const visitors = Array.from(sessionMap.entries())
      .sort(([, a], [, b]) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, limit)
      .map(([sessionId, s]) => {
        const pages = s.paths.size;
        const stage = inferStage(s.visits, pages);
        const durationMs = s.lastSeen.getTime() - s.firstSeen.getTime();
        const durationSeconds = Math.floor(durationMs / 1000);
        const durationMinutes = Math.floor(durationSeconds / 60);
        const remainingSeconds = durationSeconds % 60;
        const sessionDuration =
          durationMinutes > 0
            ? `${durationMinutes}m ${remainingSeconds}s`
            : `${remainingSeconds}s`;
        const initials = sessionId.slice(-2).toUpperCase();
        const color = COLORS_LIST[s.colorIdx] ?? COLORS_LIST[0]!;
        return {
          id: sessionId,
          sessionId,
          email: s.email || null,
          lastSeen: timeAgo(s.lastSeen),
          sessionDuration,
          visits: s.visits,
          pages,
          stage,
          initials,
          color,
          entryPage: resolvePageMeta(s.entryPage).label,
          pageList: Array.from(s.paths).slice(0, 8).map((p) => resolvePageMeta(p).label),
        };
      });

    res.status(200).json({ visitors, total: sessionMap.size });
  } catch (e) {
    console.error("getVisitorJourney:", e);
    res.status(500).json({ error: "Failed to load visitor journey" });
  }
};

/**
 * Admin: Download visitor journey data as a CSV.
 */
export const downloadVisitorJourney = async (req: Request, res: Response) => {
  try {
    const rangeParam = String(req.query.range || "30d");
    const days = RANGE_DAYS[rangeParam] ?? 30;

    const end = new Date();
    const start = addDays(startOfUtcDay(end), -(days - 1));

    const docs = await SitePageView.find({
      visitedAt: { $gte: start, $lte: end },
    } as any)
      .sort({ visitedAt: -1 })
      .lean()
      .exec();

    const sessionMap = new Map<
      string,
      {
        firstSeen: Date;
        lastSeen: Date;
        visits: number;
        paths: Set<string>;
        entryPage: string;
        email?: string;
      }
    >();

    for (const d of docs) {
      if (!sessionMap.has(d.sessionId)) {
        sessionMap.set(d.sessionId, {
          firstSeen: new Date(d.visitedAt),
          lastSeen: new Date(d.visitedAt),
          visits: 0,
          paths: new Set(),
          entryPage: d.path,
        });
      }
      const s = sessionMap.get(d.sessionId)!;
      s.visits += 1;
      s.paths.add(d.path);
      if (new Date(d.visitedAt) > s.lastSeen) s.lastSeen = new Date(d.visitedAt);
      if (new Date(d.visitedAt) < s.firstSeen) s.firstSeen = new Date(d.visitedAt);
      if (!s.email && (d as any).email) s.email = (d as any).email;
    }

    const visitors = Array.from(sessionMap.entries())
      .sort(([, a], [, b]) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .map(([sessionId, s]) => {
        const pages = s.paths.size;
        const stage = inferStage(s.visits, pages);
        const durationMs = s.lastSeen.getTime() - s.firstSeen.getTime();
        const durationSeconds = Math.floor(durationMs / 1000);
        const durationMinutes = Math.floor(durationSeconds / 60);
        const remainingSeconds = durationSeconds % 60;
        const sessionDuration =
          durationMinutes > 0
            ? `${durationMinutes}m ${remainingSeconds}s`
            : `${remainingSeconds}s`;
        return {
          sessionId,
          email: s.email || "Unknown",
          stage: stage || "Unknown",
          visits: s.visits,
          uniquePagesVisited: pages,
          sessionDuration,
          entryPage: resolvePageMeta(s.entryPage).label,
          lastSeen: s.lastSeen.toISOString(),
          firstSeen: s.firstSeen.toISOString(),
        };
      });

    if (visitors.length === 0) {
      return res.status(200).send("No data available for this range.");
    }

    const headers = Object.keys(visitors[0]!).join(",");
    const rows = visitors.map((v) =>
      Object.values(v)
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csvContent = [headers, ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=visitor-journey-${rangeParam}.csv`
    );
    res.status(200).send(csvContent);
  } catch (e) {
    console.error("downloadVisitorJourney:", e);
    res.status(500).json({ error: "Failed to generate CSV download" });
  }
};