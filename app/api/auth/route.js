import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

const ACCOUNTS_KEY = 'ora_accounts';

// Check if environment variables are set
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.ora_datastorage_KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.ora_datastorage_KV_REST_API_TOKEN;
const hasEnvVars = url && token;

let redis = null;
if (hasEnvVars) {
  redis = new Redis({ url, token });
}

// POST - Verify credentials
export async function POST(request) {
  if (!hasEnvVars) {
    console.error('Missing Upstash environment variables');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Get accounts from Redis
    const accounts = await redis.get(ACCOUNTS_KEY);

    if (!accounts) {
      console.error('No accounts found in Redis');
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    // Check if admin_mode credentials match
    const adminAccount = accounts.admin_mode;

    if (!adminAccount) {
      console.error('No admin_mode account found');
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    // Verify credentials
    if (adminAccount.user_name === username && adminAccount.password === password) {
      return NextResponse.json({
        success: true,
        message: 'Authentication successful'
      });
    }

    return NextResponse.json(
      { error: 'Invalid username or password' },
      { status: 401 }
    );

  } catch (error) {
    console.error('Authentication error:', error.message);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
