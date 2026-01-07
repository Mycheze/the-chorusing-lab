import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/supabase';
import { matchFilesToCSV } from '@/lib/bulk-upload/file-matcher';

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

    const body = await request.json();
    const { csvRows, uploadedFilenames } = body;

    if (!csvRows || !Array.isArray(csvRows)) {
      return NextResponse.json(
        { error: 'Invalid CSV rows data' },
        { status: 400 }
      );
    }

    if (!uploadedFilenames || !Array.isArray(uploadedFilenames)) {
      return NextResponse.json(
        { error: 'Invalid uploaded filenames' },
        { status: 400 }
      );
    }

    // Convert filenames to File-like objects for matching
    // We only need the name property for matching
    const fileObjects = uploadedFilenames.map((filename: string) => ({
      name: filename,
    })) as File[];

    // Perform matching
    const matchingResult = matchFilesToCSV(fileObjects, csvRows);

    return NextResponse.json({
      success: true,
      matches: matchingResult.matches.map(match => ({
        csvRowIndex: match.csvRowIndex,
        filename: match.file.name,
        matchType: match.matchType,
      })),
      unmatchedFiles: matchingResult.unmatchedFiles.map(f => f.name),
      unmatchedCSVRows: matchingResult.unmatchedCSVRows,
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
