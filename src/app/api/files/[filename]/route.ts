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
    const clips = await serverDb.getAudioClips();
    const clip = clips.find(c => c.filename === filename);
    
    if (!clip) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Get the public URL from Supabase
    // Note: clip now needs to have storagePath property
    const storagePath = (clip as any).storagePath;
    if (!storagePath) {
      // Fallback: try to construct path from clip data
      const constructedPath = `${clip.uploadedBy}/${clip.filename}`;
      const publicUrl = getPublicUrl(constructedPath);
      
      // Redirect to the Supabase public URL
      return NextResponse.redirect(publicUrl);
    }

    const publicUrl = getPublicUrl(storagePath);
    
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