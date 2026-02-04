import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// GET - List images from public folder
export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const files = fs.readdirSync(publicDir);

    // Filter for image files
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    const images = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    });

    // Return as paths relative to public (with leading slash for use in src)
    const imagePaths = images.map(img => `/${img}`);

    return NextResponse.json({ images: imagePaths });
  } catch (error) {
    console.error('Failed to list images:', error);
    return NextResponse.json({ error: 'Failed to list images' }, { status: 500 });
  }
}
