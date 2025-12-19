import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/lib/server-database';
import { createClient } from '@supabase/supabase-js';
import { createAuthenticatedClient } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    // Get user from auth header
    let userId: string | null = null;
    let accessToken: string | null = null;
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
      const authenticatedClient = createAuthenticatedClient(accessToken);
      
      const { data: { user } } = await authenticatedClient.auth.getUser();
      if (user) userId = user.id;
    }
    
    if (!userId || !accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const success = await serverDb.starClip(id, userId, accessToken);
    
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
    // Get user from auth header
    let userId: string | null = null;
    let accessToken: string | null = null;
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
      const authenticatedClient = createAuthenticatedClient(accessToken);
      
      const { data: { user } } = await authenticatedClient.auth.getUser();
      if (user) userId = user.id;
    }
    
    if (!userId || !accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const success = await serverDb.unstarClip(id, userId, accessToken);
    
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