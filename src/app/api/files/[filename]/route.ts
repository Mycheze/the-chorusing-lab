import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/lib/server-database';
import { getPublicUrl } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    let { filename } = params;

    // Decode URL-encoded filename
    try {
      filename = decodeURIComponent(filename);
    } catch (decodeError) {
      // Use raw filename if decoding fails
    }

    // Basic security check - prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    // Find the audio clip with this filename to get its storage path
    const clip = await serverDb.getAudioClipByFilename(filename);

    if (!clip) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Get the public URL from Supabase
    const publicUrl = getPublicUrl(clip.storagePath);

    // Redirect to the Supabase public URL
    return NextResponse.redirect(publicUrl);

  } catch (error) {
    console.error('File serving error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
