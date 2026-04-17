import { Router } from 'express';
import type { Request, Response } from 'express';
import { PageView } from './page-view.model.js';

const router = Router();

// Helper function to calculate date range
function getDateRange(range: string): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const end = new Date();
  const start = new Date();
  const prevEnd = new Date();
  const prevStart = new Date();
  
  switch (range) {
    case '7d':
      start.setDate(start.getDate() - 7);
      prevEnd.setDate(prevEnd.getDate() - 7);
      prevStart.setDate(prevStart.getDate() - 14);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      prevEnd.setDate(prevEnd.getDate() - 30);
      prevStart.setDate(prevStart.getDate() - 60);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      prevEnd.setDate(prevEnd.getDate() - 90);
      prevStart.setDate(prevStart.getDate() - 180);
      break;
    default:
      start.setDate(start.getDate() - 30);
      prevEnd.setDate(prevEnd.getDate() - 30);
      prevStart.setDate(prevStart.getDate() - 60);
  }
  
  return { start, end, prevStart, prevEnd };
}

// Helper function to identify funnel URLs
function isFunnelUrl(url: string): boolean {
  return url.includes('/preview/') || url.includes('/funnel/') || url.includes('/ghl/');
}

// Helper function to extract funnel name from URL
function extractFunnelName(url: string): string {
  const parts = url.split('/');
  const lastPart = parts[parts.length - 1];
  return lastPart || 'Unknown Funnel';
}

// GET /api/page-views/funnels - Get all funnel analytics
router.get('/funnels', async (req: Request, res: Response) => {
  try {
    const range = req.query.range as string || '30d';
    const { start, end } = getDateRange(range);

    // Aggregate funnel data
    const funnelData = await PageView.aggregate([
      {
        $match: {
          timestamp: { $gte: start, $lte: end },
          url: { $regex: /preview|funnel|ghl/, $options: 'i' }
        }
      },
      {
        $group: {
          _id: '$url',
          totalViews: { $sum: 1 },
          uniqueViews: { $sum: { $cond: ['$isUnique', 1, 0] } },
          conversions: { $sum: { $cond: ['$isConversion', 1, 0] } },
          funnelName: { $first: '$funnelName' }
        }
      },
      {
        $project: {
          _id: 0,
          url: '$_id',
          name: { $ifNull: ['$funnelName', '$_id'] },
          views: '$totalViews',
          unique: '$uniqueViews',
          conversions: '$conversions',
          convRate: {
            $cond: [
              { $eq: ['$totalViews', 0] },
              0,
              { $multiply: [{ $divide: ['$conversions', '$totalViews'] }, 100] }
            ]
          },
          change: { $literal: 0 }
        }
      },
      {
        $sort: { views: -1 }
      }
    ]);

    // Add colors to funnels
    const colors = ['#800000', '#0D9488', '#7C3AED', '#F59E0B', '#EC4899', '#059669', '#D97706', '#DC2626'];
    const funnels = funnelData.map((funnel: any, index: number) => ({
      ...funnel,
      color: colors[index % colors.length]
    }));

    res.json({ funnels });
  } catch (error) {
    console.error('Error fetching funnel data:', error);
    res.status(500).json({ error: 'Failed to fetch funnel data' });
  }
});

// GET /api/page-views/funnels/:url - Get specific funnel details
router.get('/funnels/:url', async (req: Request, res: Response) => {
  try {
    const range = req.query.range as string || '30d';
    const { start, end } = getDateRange(range);
    const funnelUrl = decodeURIComponent(req.params.url as string);

    // Get daily data for the funnel
    const dailyData = await PageView.aggregate([
      {
        $match: {
          timestamp: { $gte: start, $lte: end },
          url: funnelUrl
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          },
          date: { $first: '$timestamp' },
          views: { $sum: 1 },
          unique: { $sum: { $cond: ['$isUnique', 1, 0] } },
          conversions: { $sum: { $cond: ['$isConversion', 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$date'
            }
          },
          views: 1,
          unique: 1,
          conversions: 1
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);

    // Get totals for the funnel
    const totals = await PageView.aggregate([
      {
        $match: {
          timestamp: { $gte: start, $lte: end },
          url: funnelUrl
        }
      },
      {
        $group: {
          _id: null,
          views: { $sum: 1 },
          unique: { $sum: { $cond: ['$isUnique', 1, 0] } },
          conversions: { $sum: { $cond: ['$isConversion', 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          views: 1,
          unique: 1,
          conversions: 1
        }
      }
    ]);

    const result = {
      daily: dailyData,
      totals: totals[0] || { views: 0, unique: 0, conversions: 0 }
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching funnel details:', error);
    res.status(500).json({ error: 'Failed to fetch funnel details' });
  }
});

// POST /api/page-views/track - Track a page view (for future use)
router.post('/track', async (req: Request, res: Response) => {
  try {
    const { url, sessionId, userAgent, ip, referrer, isConversion, funnelName } = req.body;

    // Check if this is a unique view for this session
    const existingView = await PageView.findOne({
      url,
      sessionId,
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });

    const pageView = new PageView({
      url,
      sessionId,
      userAgent,
      ip,
      referrer,
      isUnique: !existingView,
      isConversion: isConversion || false,
      funnelName: funnelName || extractFunnelName(url)
    });

    await pageView.save();

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error tracking page view:', error);
    res.status(500).json({ error: 'Failed to track page view' });
  }
});

// Helper functions
function extractBrowser(userAgent?: string): string {
  if (!userAgent) return 'Unknown';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Other';
}

function extractDevice(userAgent?: string): string {
  if (!userAgent) return 'Desktop'; // Default to desktop if unknown
  if (userAgent.includes('Mobile')) return 'Mobile';
  if (userAgent.includes('Tablet')) return 'Tablet';
  return 'Desktop';
}

function extractSource(referrer?: string): string {
  if (!referrer || referrer === '' || referrer === 'null' || referrer === 'undefined') return 'Direct';
  const r = referrer.toLowerCase();
  if (r.includes('google') || r.includes('bing') || r.includes('yahoo') || r.includes('search')) return 'Organic Search';
  if (r.includes('facebook') || r.includes('t.co') || r.includes('twitter') || r.includes('instagram') || r.includes('linkedin') || r.includes('social')) return 'Social';
  if (r.includes('mail')) return 'Email';
  return 'Referral';
}

// GET /dashboard/page-views - Get page views overview for dashboard
router.get('/dashboard/page-views', async (req: Request, res: Response) => {
  try {
    const range = req.query.range as string || '30d';
    const { start, end, prevStart, prevEnd } = getDateRange(range);

    // Current period statistics
    const currentStats = await PageView.aggregate([
      {
        $match: {
          timestamp: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: 1 },
          uniqueViews: { $sum: { $cond: ['$isUnique', 1, 0] } },
          sessions: { $addToSet: '$sessionId' },
          conversions: { $sum: { $cond: ['$isConversion', 1, 0] } }
        }
      }
    ]);

    const current = currentStats[0] || { totalViews: 0, uniqueViews: 0, sessions: [], conversions: 0 };
    const currentSessionCount = Array.isArray(current.sessions) ? current.sessions.length : 0;

    // Previous period statistics
    const previousStats = await PageView.aggregate([
      {
        $match: {
          timestamp: { $gte: prevStart, $lte: prevEnd }
        }
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: 1 },
          uniqueViews: { $sum: { $cond: ['$isUnique', 1, 0] } },
          sessions: { $addToSet: '$sessionId' }
        }
      }
    ]);

    const previous = previousStats[0] || { totalViews: 0, uniqueViews: 0, sessions: [] };
    const previousSessionCount = Array.isArray(previous.sessions) ? previous.sessions.length : 0;

    // Helper for percentage change
    const calcChange = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Number(((curr - prev) / prev * 100).toFixed(1));
    };

    // Daily trends
    const daily = await PageView.aggregate([
      {
        $match: {
          timestamp: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          },
          date: { $first: '$timestamp' },
          views: { $sum: 1 },
          unique: { $sum: { $cond: ['$isUnique', 1, 0] } },
          conversions: { $sum: { $cond: ['$isConversion', 1, 0] } },
          sessions: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$date'
            }
          },
          views: 1,
          unique: 1,
          conversions: 1,
          sessions: { $size: '$sessions' }
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);

    // Top pages
    const topPages = await PageView.aggregate([
      {
        $match: {
          timestamp: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$url',
          views: { $sum: 1 },
          unique: { $sum: { $cond: ['$isUnique', 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          url: '$_id',
          views: 1,
          unique: 1
        }
      },
      {
        $sort: { views: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Devices breakdown
    const rawDevices = await PageView.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: '$userAgent', views: { $sum: 1 } } }
    ]);

    const deviceCounts: Record<string, number> = { Desktop: 0, Mobile: 0, Tablet: 0 };
    rawDevices.forEach(d => {
      const device = extractDevice(d._id);
      if (deviceCounts[device] !== undefined) deviceCounts[device] += d.views;
    });
    const devices = Object.entries(deviceCounts).map(([device, views]) => ({ device, views }));

    // Traffic sources breakdown
    const rawSources = await PageView.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: '$referrer', views: { $sum: 1 } } }
    ]);

    const sourceCounts: Record<string, number> = {
      'Organic Search': 0,
      'Direct': 0,
      'Social': 0,
      'Referral': 0,
      'Email': 0
    };

    rawSources.forEach(s => {
      const source = extractSource(s._id);
      sourceCounts[source] += s.views;
    });

    const colors = ["#378ADD", "#1D9E75", "#7F77DD", "#EF9F27", "#D85A30"];
    const trafficSources = Object.entries(sourceCounts).map(([name, value], index) => ({
      name,
      value,
      color: colors[index]
    })).filter(s => s.value > 0);

    // If all are 0, add a dummy direct for UI
    if (trafficSources.length === 0) {
      trafficSources.push({ name: 'Direct', value: 0, color: colors[1] });
    }

    const result = {
      overview: {
        totalViews: current.totalViews,
        uniqueViews: current.uniqueViews,
        sessions: currentSessionCount,
        conversions: current.conversions,
        avgPagesPerVisit: currentSessionCount > 0 ? Number((current.totalViews / currentSessionCount).toFixed(1)) : 0,
        bounceRate: 35.5, // Placeholder - requires more complex session analysis
      },
      changes: {
        views: calcChange(current.totalViews, previous.totalViews),
        unique: calcChange(current.uniqueViews, previous.uniqueViews),
        sessions: calcChange(currentSessionCount, previousSessionCount),
        bounceRate: -2.1 // Placeholder
      },
      daily,
      topPages,
      devices,
      trafficSources
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching page views overview:', error);
    res.status(500).json({ error: 'Failed to fetch page views overview' });
  }
});

// GET /dashboard/page-views/visitors - Get visitor data
router.get('/dashboard/page-views/visitors', async (req: Request, res: Response) => {
  try {
    const range = req.query.range as string || '30d';
    const { start, end } = getDateRange(range);

    // Get visitor sessions with their page view activity
    const visitors = await PageView.aggregate([
      {
        $match: {
          timestamp: { $gte: start, $lte: end },
          sessionId: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$sessionId',
          firstVisit: { $min: '$timestamp' },
          lastVisit: { $max: '$timestamp' },
          pageViews: { $sum: 1 },
          uniqueViews: { $sum: { $cond: ['$isUnique', 1, 0] } },
          conversions: { $sum: { $cond: ['$isConversion', 1, 0] } },
          pages: { $addToSet: '$url' },
          userAgent: { $first: '$userAgent' },
          ip: { $first: '$ip' }
        }
      },
      {
        $project: {
          _id: 0,
          id: '$_id', // Match frontend VisitorRow.id
          sessionId: '$_id',
          firstVisit: 1,
          lastVisit: 1,
          pageViews: 1,
          uniqueViews: 1,
          conversions: 1,
          pageCount: { $size: '$pages' },
          pages: 1,
          userAgent: 1,
          ip: 1,
          duration: {
            $divide: [
              { $subtract: ['$lastVisit', '$firstVisit'] },
              1000 * 60 // Convert to minutes
            ]
          }
        }
      },
      {
        $sort: { lastVisit: -1 }
      },
      {
        $limit: 100
      }
    ]);

    res.json({ 
      visitors: visitors.map(v => ({
        ...v,
        browser: extractBrowser(v.userAgent),
        location: 'Unknown',
        device: extractDevice(v.userAgent),
        initials: (v.sessionId || 'V').substring(0, 2).toUpperCase(),
        color: '#800000', // Default color
        lastSeen: formatLastSeen(v.lastVisit),
        visits: v.pageViews,
        stage: v.conversions > 0 ? 'Converted' : v.pageViews > 5 ? 'Decision' : v.pageViews > 2 ? 'Consideration' : 'Awareness'
      })),
      total: visitors.length
    });
  } catch (error) {
    console.error('Error fetching visitor data:', error);
    res.status(500).json({ error: 'Failed to fetch visitor data' });
  }
});

// GET /dashboard/page-views/visitors/download - Download visitor data as CSV
router.get('/dashboard/page-views/visitors/download', async (req: Request, res: Response) => {
  try {
    const range = req.query.range as string || '30d';
    const { start, end } = getDateRange(range);

    const visitors = await PageView.aggregate([
      {
        $match: {
          timestamp: { $gte: start, $lte: end },
          sessionId: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$sessionId',
          firstVisit: { $min: '$timestamp' },
          lastVisit: { $max: '$timestamp' },
          pageViews: { $sum: 1 },
          uniqueViews: { $sum: { $cond: ['$isUnique', 1, 0] } },
          conversions: { $sum: { $cond: ['$isConversion', 1, 0] } },
          pages: { $addToSet: '$url' },
          userAgent: { $first: '$userAgent' },
          ip: { $first: '$ip' }
        }
      },
      {
        $project: {
          _id: 0,
          sessionId: '$_id',
          firstVisit: 1,
          lastVisit: 1,
          pageViews: 1,
          uniqueViews: 1,
          conversions: 1,
          pageCount: { $size: '$pages' },
          userAgent: 1,
          ip: 1
        }
      },
      {
        $sort: { firstVisit: -1 }
      }
    ]);

    // Generate CSV
    const csvHeaders = ['Session ID', 'First Visit', 'Last Visit', 'Page Views', 'Unique Views', 'Conversions', 'Pages', 'User Agent', 'IP'];
    const csvRows = visitors.map(v => [
      v.sessionId,
      v.firstVisit.toISOString(),
      v.lastVisit.toISOString(),
      v.pageViews,
      v.uniqueViews,
      v.conversions,
      `"${v.pages.join('; ')}"`,
      `"${v.userAgent || ''}"`,
      v.ip || ''
    ]);

    const csv = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="visitors_${range}_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error downloading visitor data:', error);
    res.status(500).json({ error: 'Failed to download visitor data' });
  }
});

function formatLastSeen(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default router;
