import { NextResponse } from 'next/server';
import { currentSession } from '@/lib/session';

export async function GET() {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  return NextResponse.json({ username: s.username, role: s.role });
}
