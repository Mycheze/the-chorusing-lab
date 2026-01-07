import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/lib/server-database';
import { uploadAudioFile, createAuthenticatedClient, verifyAccessToken } from '@/lib/supabase';
import type { AudioMetadata } from '@/types/audio';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const SUPPORTED_FORMATS = ['mp3', 'wav', 'm4a', 'ogg', 'webm'];

function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const extension = originalName.split('.').pop()?.toLowerCase() || '';
  const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9\-_]/g, '_');
  return `${timestamp}-${random}-${baseName}.${extension}`;
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`;
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !SUPPORTED_FORMATS.includes(extension)) {
    return `Unsupported format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`;
  }

  return null;
}

// Note: Duration calculation is done client-side and passed in the form data
// This avoids using browser APIs in the server environment

export async function POST(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.substring(7);
    const { user, error: authError } = await verifyAccessToken(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const authenticatedClient = createAuthenticatedClient(accessToken);

    // Parse form data
    const formData = await request.formData();
    
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const durationStr = formData.get('duration') as string;
    const language = formData.get('language') as string;
    const speakerGender = formData.get('speakerGender') as string;
    const speakerAgeRange = formData.get('speakerAgeRange') as string;
    const speakerDialect = formData.get('speakerDialect') as string;
    const transcript = formData.get('transcript') as string;
    const sourceUrl = formData.get('sourceUrl') as string;
    const tags = formData.get('tags') as string;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!title?.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!language?.trim()) {
      return NextResponse.json(
        { error: 'Language is required' },
        { status: 400 }
      );
    }

    // Validate file
    const fileValidationError = validateFile(file);
    if (fileValidationError) {
      return NextResponse.json(
        { error: fileValidationError },
        { status: 400 }
      );
    }

    // Get duration from form data (calculated client-side)
    let duration: number;
    
    if (durationStr && !isNaN(Number(durationStr)) && Number(durationStr) > 0 && isFinite(Number(durationStr))) {
      duration = Number(durationStr);
    } else {
      return NextResponse.json(
        { error: 'Duration is required. Please ensure the audio file is valid.' },
        { status: 400 }
      );
    }

    // Final validation of duration
    if (!duration || isNaN(duration) || duration <= 0 || !isFinite(duration)) {
      return NextResponse.json(
        { error: 'Invalid audio duration detected. Please try a different audio file.' },
        { status: 400 }
      );
    }
    
    if (duration > 300) {
      return NextResponse.json(
        { error: 'Audio file too long. Maximum duration is 5 minutes for direct uploads.' },
        { status: 400 }
      );
    }

    // Validate speaker age range if provided
    const validAgeRanges = ['teen', 'younger-adult', 'adult', 'senior'];
    if (speakerAgeRange && !validAgeRanges.includes(speakerAgeRange)) {
      return NextResponse.json(
        { error: 'Invalid speaker age range' },
        { status: 400 }
      );
    }

    // Validate speaker gender if provided
    const validGenders = ['male', 'female', 'other'];
    if (speakerGender && !validGenders.includes(speakerGender)) {
      return NextResponse.json(
        { error: 'Invalid speaker gender' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const filename = generateUniqueFilename(file.name);

    try {
      // Upload file to Supabase Storage
      const storagePath = await uploadAudioFile(file, userId, filename, authenticatedClient);

      // Prepare metadata
      const metadata: AudioMetadata = {
        language: language.trim(),
        speakerGender: speakerGender as any || undefined,
        speakerAgeRange: speakerAgeRange as any || undefined,
        speakerDialect: speakerDialect?.trim() || undefined, // Empty string becomes undefined (optional field)
        transcript: transcript || undefined,
        sourceUrl: sourceUrl || undefined,
        tags: tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
      };

      // Save to database
      const audioClip = await serverDb.createAudioClip({
        title: title.trim(),
        duration: duration,
        filename,
        originalFilename: file.name,
        fileSize: file.size,
        storagePath,
        metadata,
        uploadedBy: userId,
      }, accessToken);

      return NextResponse.json({
        success: true,
        clip: audioClip,
      });

    } catch (uploadError) {
      console.error('Upload process failed:', uploadError);
      throw uploadError;
    }

  } catch (error) {
    console.error('Process error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed. Please try again.' },
      { status: 500 }
    );
  }
}
