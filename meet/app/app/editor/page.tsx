'use client';

import React, { useEffect, useState } from 'react';
import { LoginForm } from '@/lib/LoginForm';
import { RoomManager, type Me } from '@/lib/RoomManager';

export default function EditorPage() {
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
  if (!me) return <LoginForm title="Editor sign in" onSuccess={setMe} />;

  return (
    <main style={{ maxWidth: 780, margin: '3rem auto', padding: '0 1rem' }}>
      <RoomManager me={me} onSignOut={signOut} />
    </main>
  );
}
