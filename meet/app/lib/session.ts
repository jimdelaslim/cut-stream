import crypto from 'crypto';
import { cookies } from 'next/headers';
import type { Role } from '@/lib/auth-store';

const COOKIE = 'cs_session';
const MAX_AGE = 60 * 60 * 12; // 12 hours

export type Session = { username: string; role: Role; exp: number };

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.LIVEKIT_API_SECRET;
  if (!s) throw new Error('SESSION_SECRET not configured');
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function encode(session: Session): string {
  const body = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function decode(token: string | undefined): Session | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString()) as Session;
    if (!s.exp || s.exp < Date.now() / 1000) return null;
    return s;
  } catch {
    return null;
  }
}

export async function startSession(username: string, role: Role): Promise<void> {
  const session: Session = {
    username,
    role,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE,
  };
  (await cookies()).set(COOKIE, encode(session), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Current session, or null. */
export async function currentSession(): Promise<Session | null> {
  return decode((await cookies()).get(COOKIE)?.value);
}

/** Session for a request, for route handlers that receive one. */
export function sessionFromRequest(req: Request): Session | null {
  const header = req.headers.get('cookie') || '';
  const match = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  return decode(match?.slice(COOKIE.length + 1));
}
