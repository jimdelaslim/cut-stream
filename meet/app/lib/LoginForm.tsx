'use client';

import React, { useState } from 'react';

export function LoginForm({
  title,
  onSuccess,
}: {
  title: string;
  onSuccess: (me: { username: string; role: 'admin' | 'editor' }) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'sign in failed');
      onSuccess(d);
    } catch (e: any) {
      setErr(e.message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 360, margin: '6rem auto', padding: '0 1rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>{title}</h2>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoComplete="username"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
        />
        <button className="lk-button" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {err && <p style={{ color: '#f87171', fontSize: '0.85rem' }}>{err}</p>}
    </main>
  );
}
