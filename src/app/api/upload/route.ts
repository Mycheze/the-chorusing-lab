import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { serverDb } from '@/lib/server-database';
import { uploadAudioFile, createAuthenticatedClient } from '@/lib/supabase';
import type { AudioMetadata } from '@/types/audio';
import type { Database } from '@/types/supabase';

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

// Helper function to calculate audio duration from file
async function calculateAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };
    
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Audio duration calculation timeout'));
    }, 10000); // 10 second timeout
    
    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
      cleanup();
      
      const duration = audio.duration;
      
      if (!duration || isNaN(duration) || duration <= 0 || !isFinite(duration)) {
        reject(new Error('Invalid audio duration from file metadata'));
        return;
      }
      
      resolve(duration);
    });
    
    audio.addEventListener('error', (e) => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error('Failed to load audio for duration calculation'));
    });
    
    audio.src = objectUrl;
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Upload request received')
    
    // Get auth token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Missing or invalid Authorization header')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('🔑 Authenticating user...')

    // Create authenticated Supabase client
    const authenticatedClient = createAuthenticatedClient(accessToken)

    // Get the current user using the authenticated client
    const { data: { user }, error: authError } = await authenticatedClient.auth.getUser()
    
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError?.message)
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    const userId = user.id;
    console.log('✅ User authenticated:', userId)

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

    console.log('📝 Processing upload:', title, `(${file?.size} bytes)`)
    console.log('⏱️ Duration from form:', durationStr, typeof durationStr)

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

    // Calculate duration - try form data first, then calculate from file
    let duration: number;
    
    if (durationStr && !isNaN(Number(durationStr)) && Number(durationStr) > 0 && isFinite(Number(durationStr))) {
      duration = Number(durationStr);
      console.log('✅ Using form duration:', duration)
    } else {
      console.log('⚠️ Invalid or missing duration from form, calculating from file...')
      try {
        duration = await calculateAudioDuration(file);
        console.log('✅ Calculated duration from file:', duration)
      } catch (error) {
        console.error('❌ Failed to calculate duration:', error)
        return NextResponse.json(
          { error: 'Could not determine audio duration. Please try again with a valid audio file.' },
          { status: 400 }
        );
      }
    }

    // Final validation of duration
    if (!duration || isNaN(duration) || duration <= 0 || !isFinite(duration)) {
      console.error('❌ Invalid duration detected:', duration, typeof duration)
      return NextResponse.json(
        { error: 'Invalid audio duration detected. Please try a different audio file.' },
        { status: 400 }
      );
    }
    
    if (duration > 300) { // 5 minutes max
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
      // Upload file to Supabase Storage using authenticated client
      console.log('📤 Uploading file to Supabase Storage...');
      const storagePath = await uploadAudioFile(file, userId, filename, authenticatedClient);
      console.log('✅ File uploaded successfully:', storagePath);

      // Prepare metadata
      const metadata: AudioMetadata = {
        language: language.trim(),
        speakerGender: speakerGender as any || undefined,
        speakerAgeRange: speakerAgeRange as any || undefined,
        speakerDialect: speakerDialect || undefined,
        transcript: transcript || undefined,
        sourceUrl: sourceUrl || undefined,
        tags: tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
      };

      // Save to database using authenticated context
      console.log('💾 Saving clip metadata to database...');
      console.log('💾 Duration being saved:', duration, typeof duration);
      
      const audioClip = await serverDb.createAudioClip({
        title: title.trim(),
        duration: duration, // Ensure this is a valid number
        filename,
        originalFilename: file.name,
        fileSize: file.size,
        storagePath,
        metadata,
        uploadedBy: userId,
      }, accessToken); // Pass the access token here

      console.log('✅ Upload complete:', audioClip.title)

      return NextResponse.json({
        success: true,
        clip: audioClip,
      });

    } catch (uploadError) {
      console.error('💥 Upload process failed:', uploadError);
      throw uploadError;
    }

  } catch (error) {
    console.error('❌ Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed. Please try again.' },
      { status: 500 }
    );
  }
}