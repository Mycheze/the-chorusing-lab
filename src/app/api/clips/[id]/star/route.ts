import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/lib/server-database';
import { getSession } from '@/lib/session';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Authenticate via session cookie
    const session = getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.userId;

    const success = await serverDb.starClip(id, userId);

    if (success) {
      return NextResponse.json({ success: true, message: 'Clip starred' });
    } else {
      return NextResponse.json({ success: false, message: 'Clip already starred' });
    }
  } catch (error) {
    console.error('Star error:', error);
    return NextResponse.json(
      { error: 'Failed to star clip' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Authenticate via session cookie
    const session = getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.userId;

    const success = await serverDb.unstarClip(id, userId);

    if (success) {
      return NextResponse.json({ success: true, message: 'Clip unstarred' });
    } else {
      return NextResponse.json({ success: false, message: 'Clip not starred' });
    }
  } catch (error) {
    console.error('Unstar error:', error);
    return NextResponse.json(
      { error: 'Failed to unstar clip' },
      { status: 500 }
    );
  }
}
