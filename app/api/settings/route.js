import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

const SETTINGS_KEY = 'site_settings';

// Check if environment variables are set (supports both naming conventions)
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.ora_datastorage_KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.ora_datastorage_KV_REST_API_TOKEN;
const hasEnvVars = url && token;

// Initialize Redis only if env vars exist
let redis = null;
if (hasEnvVars) {
  redis = new Redis({ url, token });
}

// GET - Retrieve settings
export async function GET() {
  // Check for missing env vars
  if (!hasEnvVars) {
    console.error('Missing Upstash environment variables');
    console.error('URL:', url ? 'SET' : 'MISSING');
    console.error('TOKEN:', token ? 'SET' : 'MISSING');
    return NextResponse.json(
      { error: 'Server configuration error - missing environment variables' },
      { status: 500 }
    );
  }

  try {
    const settings = await redis.get(SETTINGS_KEY);
    return NextResponse.json(settings || {});
  } catch (error) {
    console.error('Failed to fetch settings:', error.message);
    return NextResponse.json(
      { error: `Failed to fetch settings: ${error.message}` },
      { status: 500 }
    );
  }
}

// POST - Save settings
export async function POST(request) {
  // Check for missing env vars
  if (!hasEnvVars) {
    console.error('Missing Upstash environment variables');
    return NextResponse.json(
      { error: 'Server configuration error - missing environment variables' },
      { status: 500 }
    );
  }

  try {
    const settings = await request.json();

    // Validate that settings is an object
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Invalid settings format' },
        { status: 400 }
      );
    }

    await redis.set(SETTINGS_KEY, settings);
    console.log('Settings saved successfully to Upstash');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save settings:', error.message);
    return NextResponse.json(
      { error: `Failed to save settings: ${error.message}` },
      { status: 500 }
    );
  }
}
