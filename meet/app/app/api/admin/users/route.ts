import { NextResponse } from 'next/server';
import { createUser, deleteUser, listUsers, normaliseUsername, setPassword } from '@/lib/auth-store';
import { sessionFromRequest } from '@/lib/session';

function requireAdmin(req: Request) {
  const s = sessionFromRequest(req);
  return s && s.role === 'admin' ? s : null;
}

export async function GET(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ users: await listUsers() });
}

export async function POST(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const username = String(body.username || '');
  const password = String(body.password || '');

  try {
    const user = await createUser(username, password, 'editor');
    return NextResponse.json(user);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'could not create user' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const username = String(body.username || '');
  const password = String(body.password || '');

  try {
    await setPassword(username, password);
    return NextResponse.json({ ok: true, username: normaliseUsername(username) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'could not set password' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const username = normaliseUsername(new URL(req.url).searchParams.get('username') || '');
  if (!username) return NextResponse.json({ error: 'invalid username' }, { status: 400 });
  if (username === 'admin') {
    return NextResponse.json({ error: 'cannot delete the admin account' }, { status: 400 });
  }

  await deleteUser(username);
  return NextResponse.json({ ok: true, username });
}
