# Enhancement: Vercel Blob Storage for Image Uploads

## Overview
This document outlines how to implement direct image uploads using Vercel Blob Storage, allowing admins to upload custom icons and images through the admin panel instead of selecting from pre-existing files.

## Current Approach
Images are stored locally in the `public/` folder:
- `public/ui-buttons/` - Button icons (e.g., floating Book Now button)
- `public/ui-images/` - General UI images

The admin panel selects from existing images via the `/api/images` endpoint, and the image path is stored in Upstash-KV as part of `site_settings.interactible_config`.

## Enhancement: Vercel Blob Storage

### Benefits
- Upload images directly from admin panel
- No need to redeploy to add new images
- CDN-delivered for fast loading
- Scalable storage

### Cost
- **Free tier**: 1GB storage, 1GB bandwidth/month (more than sufficient for this site)
- **Pro**: Included with Vercel Pro plan

---

## Implementation Steps

### 1. Install the package
```bash
npm install @vercel/blob
```

### 2. Create a Blob Store in Vercel Dashboard
1. Go to your project on [vercel.com](https://vercel.com)
2. Navigate to **Storage** tab
3. Click **Create Database** → Select **Blob**
4. Name it (e.g., `orm-images`)
5. Click **Create**

This automatically adds the `BLOB_READ_WRITE_TOKEN` environment variable to your project.

### 3. Pull the environment variable locally
```bash
vercel env pull .env.local
```

### 4. Create an upload API route

Create `app/api/upload/route.js`:

```js
import { put, del, list } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'ui-images'; // 'ui-buttons' or 'ui-images'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Validate file size (max 500KB for icons)
    const maxSize = folder === 'ui-buttons' ? 500 * 1024 : 2 * 1024 * 1024; // 500KB for buttons, 2MB for images
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    const blob = await put(`${folder}/${file.name}`, file, {
      access: 'public',
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// List uploaded images
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || '';

    const { blobs } = await list({
      prefix: folder ? `${folder}/` : undefined,
    });

    return NextResponse.json({
      images: blobs.map(blob => ({
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt
      }))
    });
  } catch (error) {
    console.error('List error:', error);
    return NextResponse.json({ error: 'Failed to list images' }, { status: 500 });
  }
}

// Delete an image
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    await del(url);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
```

### 5. Create an upload component for admin panel

```jsx
// components/ImageUploader.jsx
import { useState } from 'react';

const ImageUploader = ({ folder = 'ui-images', onUpload, maxSizeKB = 500 }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Client-side validation
    if (file.size > maxSizeKB * 1024) {
      setError(`File must be under ${maxSizeKB}KB`);
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        onUpload(data.url);
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="image-uploader">
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
      />
      {uploading && <span>Uploading...</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
};

export default ImageUploader;
```

### 6. Update admin UI to use uploader

In the UI Interactibles section, replace the dropdown selector with the upload component:

```jsx
// Instead of:
<select value={settings.interactible_config?.floatingBookNow?.mobile?.icon || ''}>
  {availableImages.map(img => <option key={img} value={img}>{img}</option>)}
</select>

// Use:
<ImageUploader
  folder="ui-buttons"
  maxSizeKB={100}
  onUpload={(url) => updateInteractibleConfig('mobile', 'icon', url)}
/>
{settings.interactible_config?.floatingBookNow?.mobile?.icon && (
  <img src={settings.interactible_config.floatingBookNow.mobile.icon} alt="Preview" />
)}
```

---

## Storage Structure

### Vercel Blob (after implementation)
```
vercel-blob/
├── ui-buttons/
│   ├── calendar-icon.png
│   └── book-now-icon.svg
└── ui-images/
    ├── promo-banner.jpg
    └── seasonal-graphic.png
```

### Settings stored in Upstash-KV
```js
site_settings: {
  interactible_config: {
    floatingBookNow: {
      mobile: {
        icon: 'https://abc123.public.blob.vercel-storage.com/ui-buttons/calendar-icon.png'
      }
    }
  }
}
```

---

## Migration Path

1. Implement the upload API and component
2. Keep existing `/api/images` endpoint for backward compatibility
3. Admin can choose to:
   - Select from existing local images (current behavior)
   - Upload new images (new feature)
4. Existing settings continue to work unchanged

---

## Security Considerations

- Validate file types server-side
- Limit file sizes (500KB for buttons, 2MB for general images)
- Consider adding authentication check to upload endpoint
- Optionally add rate limiting to prevent abuse
