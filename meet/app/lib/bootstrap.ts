import { createUser, getUser } from '@/lib/auth-store';

let done = false;

/**
 * Creates the admin account from ADMIN_PASSWORD the first time it's needed.
 * Idempotent: once 'admin' exists in users.json this does nothing, so
 * changing the password later is done through the UI, not the env var.
 */
export async function ensureAdmin(): Promise<void> {
  if (done) return;
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    done = true;
    return;
  }
  const existing = await getUser('admin');
  if (!existing) {
    try {
      await createUser('admin', pw, 'admin');
      console.log('[bootstrap] created admin account from ADMIN_PASSWORD');
    } catch (e) {
      console.error('[bootstrap] could not create admin:', e);
    }
  }
  done = true;
}
