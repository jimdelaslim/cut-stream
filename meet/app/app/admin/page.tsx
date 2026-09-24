'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LoginForm } from '@/lib/LoginForm';
import { RoomManager, type Me } from '@/lib/RoomManager';

type UserRow = { username: string; role: 'admin' | 'editor'; createdAt: string };

const small: React.CSSProperties = {
  padding: '0.2rem 0.6rem',
  fontSize: '0.75rem',
  minWidth: '6.5rem',
  textAlign: 'center',
};
const danger: React.CSSProperties = {
  ...small,
  background: '#7f1d1d',
  borderColor: '#b91c1c',
  color: '#fff',
};

function Editors() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/users');
    if (!res.ok) return;
    const d = await res.json();
    setUsers(d.users || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'could not create');
      setUsername('');
      setPassword('');
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u: string) => {
    setBusy(true);
    await fetch(`/api/admin/users?username=${encodeURIComponent(u)}`, { method: 'DELETE' });
    setPending(null);
    await load();
    setBusy(false);
  };

  return (
    <section style={{ marginTop: '3rem', borderTop: '1px solid #1d2532', paddingTop: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.25rem' }}>Editors</h3>
      <p style={{ marginTop: 0, color: '#888', fontSize: '0.85rem' }}>
        Editors sign in at <code>/editor</code> and see only their own sessions.
      </p>

      <form
        className="cs-admin-create"
        style={{ margin: '1rem 0' }}
        onSubmit={create}
      >
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoComplete="off"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8 chars)"
          autoComplete="new-password"
        />
        <button className="lk-button" type="submit" disabled={busy || !username || !password}>
          Add editor
        </button>
      </form>

      {err && <p style={{ color: '#f87171', fontSize: '0.85rem' }}>{err}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {users
          .filter((u) => u.role !== 'admin')
          .map((u) => (
            <div key={u.username} className="cs-admin-head" style={{ marginBottom: 0 }}>
              <strong>{u.username}</strong>
              {pending === u.username ? (
                <span style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="lk-button" style={danger} onClick={() => remove(u.username)}>
                    Delete + their rooms
                  </button>
                  <button className="lk-button" style={small} onClick={() => setPending(null)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  className="lk-button"
                  style={small}
                  onClick={() => setPending(u.username)}
                >
                  remove
                </button>
              )}
            </div>
          ))}
        {users.filter((u) => u.role !== 'admin').length === 0 && (
          <p style={{ color: '#666', fontSize: '0.85rem' }}>No editors yet.</p>
        )}
      </div>
    </section>
  );
}

export default function AdminPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d))
      .finally(() => setChecked(true));
  }, []);

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
  };

  if (!checked) return null;
  if (!me) return <LoginForm title="Admin sign in" onSuccess={setMe} />;

  if (me.role !== 'admin') {
    return (
      <main style={{ maxWidth: 400, margin: '6rem auto', padding: '0 1rem' }}>
        <p>This page is for admins. Editors sign in at <a href="/editor">/editor</a>.</p>
        <button className="lk-button" onClick={signOut}>sign out</button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 780, margin: '3rem auto', padding: '0 1rem' }}>
      <RoomManager me={me} onSignOut={signOut} />
      <Editors />
    </main>
  );
}
