import { NextResponse } from 'next/server';
import { verify } from '@/lib/auth-store';
import { startSession } from '@/lib/session';
import { ensureAdmin } from '@/lib/bootstrap';

export async function POST(req: Request) {
  await ensureAdmin();
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || '');
  const password = String(body.password || '');

  if (!username || !password) {
    return NextResponse.json({ error: 'missing credentials' }, { status: 400 });
  }

  const user = await verify(username, password);
  if (!user) {
    return NextResponse.json({ error: 'invalid username or password' }, { status: 401 });
  }

  await startSession(user.username, user.role);
  return NextResponse.json({ username: user.username, role: user.role });
}
