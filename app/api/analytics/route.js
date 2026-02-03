import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

const ANALYTICS_KEY = 'ora_analytics';

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.ora_datastorage_KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.ora_datastorage_KV_REST_API_TOKEN;
const hasEnvVars = url && token;

let redis = null;
if (hasEnvVars) {
  redis = new Redis({ url, token });
}

// GET - Retrieve analytics data
export async function GET() {
  if (!hasEnvVars) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const analytics = await redis.get(ANALYTICS_KEY);
    return NextResponse.json(analytics || { pages: {}, totalVisits: 0 });
  } catch (error) {
    console.error('Failed to fetch analytics:', error.message);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

// POST - Record a page visit
export async function POST(request) {
  if (!hasEnvVars) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const { page } = await request.json();

    if (!page || page === 'admin') {
      return NextResponse.json({ success: true, skipped: true });
    }

    // Get current analytics
    let analytics = await redis.get(ANALYTICS_KEY);

    if (!analytics) {
      analytics = { pages: {}, totalVisits: 0 };
    }

    // Get today's date as key
    const today = new Date().toISOString().split('T')[0];

    // Initialize page if not exists
    if (!analytics.pages[page]) {
      analytics.pages[page] = { total: 0, daily: {} };
    }

    // Increment counters
    analytics.pages[page].total += 1;
    analytics.pages[page].daily[today] = (analytics.pages[page].daily[today] || 0) + 1;
    analytics.totalVisits += 1;

    // Save updated analytics
    await redis.set(ANALYTICS_KEY, analytics);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to record analytics:', error.message);
    return NextResponse.json({ error: 'Failed to record analytics' }, { status: 500 });
  }
}
