import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Helper to get images from a directory
function getImagesFromDir(dirPath, basePath = '') {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
  const images = [];

  try {
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
      const ext = path.extname(file).toLowerCase();
      if (imageExtensions.includes(ext)) {
        images.push(basePath ? `/${basePath}/${file}` : `/${file}`);
      }
    });
  } catch (err) {
    // Directory doesn't exist or isn't readable, skip it
  }

  return images;
}

// GET - List images from public folder and subfolders
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder'); // Optional: 'ui-buttons', 'ui-images', or null for all

    const publicDir = path.join(process.cwd(), 'public');
    let allImages = [];

    if (folder) {
      // Get images from specific folder only
      const folderPath = path.join(publicDir, folder);
      allImages = getImagesFromDir(folderPath, folder);
    } else {
      // Get images from root public folder
      allImages = getImagesFromDir(publicDir);

      // Also get images from ui-buttons and ui-images subfolders
      const uiButtonsImages = getImagesFromDir(path.join(publicDir, 'ui-buttons'), 'ui-buttons');
      const uiImagesImages = getImagesFromDir(path.join(publicDir, 'ui-images'), 'ui-images');

      allImages = [...allImages, ...uiButtonsImages, ...uiImagesImages];
    }

    return NextResponse.json({ images: allImages });
  } catch (error) {
    console.error('Failed to list images:', error);
    return NextResponse.json({ error: 'Failed to list images' }, { status: 500 });
  }
}
