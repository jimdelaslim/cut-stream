import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const STORE = process.env.USER_STORE_PATH || '/data/users.json';

export type Role = 'admin' | 'editor';

export type User = {
  username: string;
  role: Role;
  salt: string;
  hash: string;
  createdAt: string;
};

type Store = Record<string, User>;

async function read(): Promise<Store> {
  try {
    return JSON.parse(await fs.readFile(STORE, 'utf8'));
  } catch {
    return {};
  }
}

async function write(s: Store): Promise<void> {
  await fs.mkdir(path.dirname(STORE), { recursive: true });
  const tmp = `${STORE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(s, null, 2), { mode: 0o600 });
  await fs.rename(tmp, STORE);
}

/** scrypt: deliberately slow, so a stolen users.json isn't trivially cracked. */
function derive(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function normaliseUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

export async function listUsers(): Promise<Omit<User, 'salt' | 'hash'>[]> {
  const s = await read();
  return Object.values(s)
    .map(({ salt, hash, ...rest }) => rest)
    .sort((a, b) => a.username.localeCompare(b.username));
}

export async function getUser(username: string): Promise<User | null> {
  const s = await read();
  return s[normaliseUsername(username)] ?? null;
}

export async function createUser(
  username: string,
  password: string,
  role: Role = 'editor',
): Promise<Omit<User, 'salt' | 'hash'>> {
  const u = normaliseUsername(username);
  if (!u) throw new Error('invalid username');
  if (password.length < 8) throw new Error('password must be at least 8 characters');

  const s = await read();
  if (s[u]) throw new Error('username already exists');

  const salt = crypto.randomBytes(16).toString('hex');
  const rec: User = {
    username: u,
    role,
    salt,
    hash: derive(password, salt),
    createdAt: new Date().toISOString(),
  };
  s[u] = rec;
  await write(s);
  const { salt: _s, hash: _h, ...safe } = rec;
  return safe;
}

export async function setPassword(username: string, password: string): Promise<void> {
  const u = normaliseUsername(username);
  const s = await read();
  if (!s[u]) throw new Error('no such user');
  if (password.length < 8) throw new Error('password must be at least 8 characters');
  const salt = crypto.randomBytes(16).toString('hex');
  s[u] = { ...s[u], salt, hash: derive(password, salt) };
  await write(s);
}

export async function deleteUser(username: string): Promise<void> {
  const s = await read();
  delete s[normaliseUsername(username)];
  await write(s);
}

export async function verify(username: string, password: string): Promise<User | null> {
  const user = await getUser(username);
  if (!user) {
    // Burn comparable time so a missing user can't be spotted by response speed.
    crypto.scryptSync(password, 'decoy', 64);
    return null;
  }
  const candidate = Buffer.from(derive(password, user.salt), 'hex');
  const stored = Buffer.from(user.hash, 'hex');
  if (candidate.length !== stored.length) return null;
  return crypto.timingSafeEqual(candidate, stored) ? user : null;
}
