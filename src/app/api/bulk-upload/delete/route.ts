import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { serverDb } from '@/lib/server-database';

export async function POST(request: NextRequest) {
  try {
    // Authenticate via session cookie
    const session = getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.userId;

    const body = await request.json();
    const { clipIds } = body;

    if (!clipIds || !Array.isArray(clipIds)) {
      return NextResponse.json(
        { error: 'Invalid clip IDs' },
        { status: 400 }
      );
    }

    if (clipIds.length === 0) {
      return NextResponse.json(
        { error: 'No clip IDs provided' },
        { status: 400 }
      );
    }

    // Delete clips one by one
    const results = await Promise.allSettled(
      clipIds.map((clipId: string) =>
        serverDb.deleteAudioClip(clipId, userId, session.refoldId)
      )
    );

    const successful: string[] = [];
    const failed: Array<{ clipId: string; error: string }> = [];

    results.forEach((result, index) => {
      const clipId = clipIds[index];
      if (result.status === 'fulfilled' && result.value) {
        successful.push(clipId);
      } else {
        failed.push({
          clipId,
          error: result.status === 'rejected'
            ? result.reason?.message || 'Unknown error'
            : 'Delete returned false',
        });
      }
    });

    return NextResponse.json({
      success: true,
      deleted: successful.length,
      failed: failed.length,
      successful,
      errors: failed,
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bulk delete failed' },
      { status: 500 }
    );
  }
}
