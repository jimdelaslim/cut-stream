import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const STORE = process.env.ROOM_STORE_PATH || '/data/rooms.json';

export type RoomRecord = {
  room: string;
  passphrase: string;
  streamKey?: string;
  createdAt: string;
  /** username that created it; absent on rooms made before accounts existed */
  owner?: string;
};

type Store = Record<string, RoomRecord>;

async function readStore(): Promise<Store> {
  try {
    return JSON.parse(await fs.readFile(STORE, 'utf8'));
  } catch {
    return {};
  }
}

async function writeStore(s: Store): Promise<void> {
  await fs.mkdir(path.dirname(STORE), { recursive: true });
  const tmp = `${STORE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(s, null, 2), { mode: 0o600 });
  await fs.rename(tmp, STORE);
}

export function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function randomPassphrase(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export async function getRoom(room: string): Promise<RoomRecord | null> {
  const s = await readStore();
  return s[room] ?? null;
}

/** All rooms, or only those owned by `owner` when given. */
export async function listRooms(owner?: string): Promise<RoomRecord[]> {
  const s = await readStore();
  let rooms = Object.values(s);
  if (owner) rooms = rooms.filter((r) => r.owner === owner);
  return rooms.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function upsertRoom(rec: RoomRecord): Promise<RoomRecord> {
  const s = await readStore();
  s[rec.room] = rec;
  await writeStore(s);
  return rec;
}

export async function deleteRoom(room: string): Promise<void> {
  const s = await readStore();
  delete s[room];
  await writeStore(s);
}

/** Remove every room belonging to a user. Returns what was removed. */
export async function deleteRoomsOwnedBy(owner: string): Promise<RoomRecord[]> {
  const s = await readStore();
  const gone: RoomRecord[] = [];
  for (const k of Object.keys(s)) {
    if (s[k].owner === owner) {
      gone.push(s[k]);
      delete s[k];
    }
  }
  if (gone.length) await writeStore(s);
  return gone;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a || '');
  const bb = Buffer.from(b || '');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
