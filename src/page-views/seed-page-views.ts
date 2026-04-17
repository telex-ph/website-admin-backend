import { PageView } from './page-view.model.js';
import mongoose from 'mongoose';

export async function seedPageViews() {
  try {
    const existingCount = await PageView.countDocuments();
    if (existingCount > 0) {
      console.log('Page views already exist, skipping seed');
      return;
    }

    const now = new Date();
    const sampleUrls = [
      'https://ghl.com/preview/funnel1',
      'https://ghl.com/preview/funnel2', 
      'https://ghl.com/preview/funnel3',
      'https://telexph.com/funnel/sales',
      'https://telexph.com/funnel/landing',
      'https://telexph.com/funnel/webinar'
    ];

    const pageViews = [];

    // Generate sample data for the last 30 days
    for (let i = 0; i < 1000; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const timestamp = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const url = sampleUrls[Math.floor(Math.random() * sampleUrls.length)];
      
      pageViews.push({
        url,
        timestamp,
        sessionId: `session_${Math.random().toString(36).substr(2, 9)}`,
        userAgent: 'Mozilla/5.0 (Sample Browser)',
        ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        isUnique: Math.random() > 0.3, // 70% unique
        isConversion: Math.random() > 0.8, // 20% conversion
        funnelName: url?.split('/').pop() || 'Unknown'
      });
    }

    await PageView.insertMany(pageViews);
    console.log('Sample page views seeded successfully');
  } catch (error) {
    console.error('Error seeding page views:', error);
  }
}
