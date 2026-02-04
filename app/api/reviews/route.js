import { Redis } from '@upstash/redis';

// Check if environment variables are set (supports both naming conventions)                        
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.ora_datastorage_KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.ora_datastorage_KV_REST_API_TOKEN;
const hasEnvVars = url && token;

// Initialize Redis only if env vars exist                                                          
let redis = null;
if (hasEnvVars) {
  redis = new Redis({ url, token });
}

const REVIEWS_KEY = 'ora_reviews';

// GET - Fetch reviews (optionally filtered by status)
export async function GET(request) {
  if (!hasEnvVars) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'pending', 'approved', or null for all

    const reviews = await redis.get(REVIEWS_KEY) || [];

    if (status) {
      const filtered = reviews.filter(r => r.status === status);
      return Response.json({ reviews: filtered });
    }

    return Response.json({ reviews });
  } catch (error) {
    console.error('Failed to fetch reviews:', error);
    return Response.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// POST - Submit a new review (public)
export async function POST(request) {
  if (!hasEnvVars) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { name, rating, text } = await request.json();

    // Validation
    if (!name || !rating || !text) {
      return Response.json({ error: 'Name, rating, and review text are required' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return Response.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    if (text.length > 1000) {
      return Response.json({ error: 'Review text must be under 1000 characters' }, { status: 400 });
    }

    const reviews = await redis.get(REVIEWS_KEY) || [];

    const newReview = {
      id: Date.now().toString(),
      name: name.trim(),
      rating: parseInt(rating),
      text: text.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    reviews.push(newReview);
    await redis.set(REVIEWS_KEY, reviews);

    return Response.json({ success: true, message: 'Review submitted for approval' });
  } catch (error) {
    console.error('Failed to submit review:', error);
    return Response.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}

// PATCH - Update review status (admin only)
export async function PATCH(request) {
  if (!hasEnvVars) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { id, status } = await request.json();

    if (!id || !status) {
      return Response.json({ error: 'Review ID and status are required' }, { status: 400 });
    }

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    const reviews = await redis.get(REVIEWS_KEY) || [];
    const reviewIndex = reviews.findIndex(r => r.id === id);

    if (reviewIndex === -1) {
      return Response.json({ error: 'Review not found' }, { status: 404 });
    }

    reviews[reviewIndex].status = status;
    await redis.set(REVIEWS_KEY, reviews);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Failed to update review:', error);
    return Response.json({ error: 'Failed to update review' }, { status: 500 });
  }
}

// DELETE - Delete a review (admin only)
export async function DELETE(request) {
  if (!hasEnvVars) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Review ID is required' }, { status: 400 });
    }

    const reviews = await redis.get(REVIEWS_KEY) || [];
    const filtered = reviews.filter(r => r.id !== id);

    if (filtered.length === reviews.length) {
      return Response.json({ error: 'Review not found' }, { status: 404 });
    }

    await redis.set(REVIEWS_KEY, filtered);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Failed to delete review:', error);
    return Response.json({ error: 'Failed to delete review' }, { status: 500 });
  }
}
