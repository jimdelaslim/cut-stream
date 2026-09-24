import { NextResponse } from 'next/server';
import { IngressClient, IngressInput, RoomServiceClient } from 'livekit-server-sdk';
import {
  deleteRoom,
  getRoom,
  listRooms,
  randomPassphrase,
  slugify,
  upsertRoom,
} from '@/lib/room-store';
import { sessionFromRequest, type Session } from '@/lib/session';

const API_KEY = process.env.LIVEKIT_API_KEY!;
const API_SECRET = process.env.LIVEKIT_API_SECRET!;
const LIVEKIT_URL = process.env.LIVEKIT_URL!;
const WHIP_BASE = process.env.WHIP_BASE_URL || '';
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || '';

const http = () => LIVEKIT_URL.replace(/^ws/, 'http');
const ingressClient = () => new IngressClient(http(), API_KEY, API_SECRET);
const roomClient = () => new RoomServiceClient(http(), API_KEY, API_SECRET);

function auth(req: Request): Session | null {
  return sessionFromRequest(req);
}

/** Admins act on anything; editors only on rooms they own. */
async function canActOn(s: Session, room: string): Promise<boolean> {
  if (s.role === 'admin') return true;
  const rec = await getRoom(room);
  return Boolean(rec && rec.owner === s.username);
}

async function findIngressKey(room: string): Promise<string | undefined> {
  try {
    const list = await ingressClient().listIngress({ roomName: room });
    return list.find((i: any) => i.inputType === IngressInput.WHIP_INPUT)?.streamKey;
  } catch {
    return undefined;
  }
}

export async function GET(req: Request) {
  const s = auth(req);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rooms = await listRooms(s.role === 'admin' ? undefined : s.username);

  let live: Record<string, { participants: number; publishers: number }> = {};
  try {
    for (const r of await roomClient().listRooms()) {
      live[r.name] = { participants: r.numParticipants ?? 0, publishers: r.numPublishers ?? 0 };
    }
  } catch {}

  return NextResponse.json({
    rooms: rooms.map((r) => ({ ...r, live: live[r.room] ?? null })),
    publicBase: PUBLIC_BASE,
    whipBase: WHIP_BASE,
    me: { username: s.username, role: s.role },
  });
}

export async function POST(req: Request) {
  const s = auth(req);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const room = slugify(String(body.room || ''));
  if (!room) return NextResponse.json({ error: 'invalid room name' }, { status: 400 });

  const existing = await getRoom(room);
  if (existing && !(await canActOn(s, room))) {
    return NextResponse.json({ error: 'not your room' }, { status: 403 });
  }

  // Editors are capped at two rooms in total. Creating a third is refused;
  // they delete one first.
  if (!existing && s.role !== 'admin') {
    const mine = await listRooms(s.username);
    if (mine.length >= 2) {
      return NextResponse.json(
        { error: 'You can have 2 sessions at a time. Delete one to create another.' },
        { status: 403 },
      );
    }
  }

  if (body.rotateKey) {
    try {
      for (const i of await ingressClient().listIngress({ roomName: room })) {
        if (i.ingressId) await ingressClient().deleteIngress(i.ingressId);
      }
    } catch {}
  }

  let streamKey = body.rotateKey ? undefined : await findIngressKey(room);
  if (!streamKey) {
    try {
      const info = await ingressClient().createIngress(IngressInput.WHIP_INPUT, {
        name: `obs-${room}`,
        roomName: room,
        participantIdentity: 'edit-suite',
        participantName: 'Edit Suite',
        enableTranscoding: false,
      });
      streamKey = info.streamKey;
    } catch (e: any) {
      return NextResponse.json({ error: `ingress failed: ${e?.message ?? e}` }, { status: 500 });
    }
  }

  const passphrase =
    body.rotate || !existing?.passphrase ? randomPassphrase() : existing.passphrase;

  const rec = await upsertRoom({
    room,
    passphrase,
    streamKey,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    owner: existing?.owner ?? s.username,
  });

  return NextResponse.json({
    ...rec,
    joinUrl: `${PUBLIC_BASE}/rooms/${room}`,
    obsUrl: streamKey ? `${WHIP_BASE}/${streamKey}` : null,
    reused: Boolean(existing),
  });
}

/** End a live session: disconnect everyone and roll the passphrase. */
export async function PATCH(req: Request) {
  const s = auth(req);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const room = slugify(String(body.room || ''));
  if (!room) return NextResponse.json({ error: 'invalid room name' }, { status: 400 });
  if (!(await canActOn(s, room))) {
    return NextResponse.json({ error: 'not your room' }, { status: 403 });
  }

  const existing = await getRoom(room);
  if (!existing) return NextResponse.json({ error: 'unknown room' }, { status: 404 });

  let ended = false;
  try {
    await roomClient().deleteRoom(room);
    ended = true;
  } catch {}

  const rec = await upsertRoom({ ...existing, passphrase: randomPassphrase() });
  return NextResponse.json({ ...rec, ended });
}

/** Delete is admin-only. */
export async function DELETE(req: Request) {
  const s = auth(req);
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const room = slugify(new URL(req.url).searchParams.get('room') || '');
  if (!room) return NextResponse.json({ error: 'invalid room name' }, { status: 400 });
  if (!(await canActOn(s, room))) {
    return NextResponse.json({ error: 'not your room' }, { status: 403 });
  }

  try {
    for (const i of await ingressClient().listIngress({ roomName: room })) {
      if (i.ingressId) await ingressClient().deleteIngress(i.ingressId);
    }
  } catch {}

  await deleteRoom(room);
  return NextResponse.json({ ok: true, room });
}
