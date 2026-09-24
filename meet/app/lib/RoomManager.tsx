'use client';

import React, { useCallback, useEffect, useState } from 'react';

export type RoomRecord = {
  room: string;
  passphrase: string;
  streamKey?: string;
  createdAt: string;
  owner?: string;
  live?: { participants: number; publishers: number } | null;
};

export type Me = { username: string; role: 'admin' | 'editor' };

const box: React.CSSProperties = {
  background: '#1c1f24',
  border: '1px solid #2c3138',
  borderRadius: 8,
  padding: '1rem',
};
const mono: React.CSSProperties = { fontSize: '0.85rem', wordBreak: 'break-all' };
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

function Copy({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="lk-button"
      style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? 'copied' : 'copy'}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="cs-admin-row">
      <span style={{ color: '#888', fontSize: '0.8rem' }}>{label}</span>
      <span style={mono}>{value}</span>
      <Copy value={value} />
    </div>
  );
}

export function RoomManager({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [bases, setBases] = useState({ publicBase: '', whipBase: '' });
  const [newRoom, setNewRoom] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/rooms');
    if (res.status === 401) {
      onSignOut();
      return;
    }
    const d = await res.json();
    setRooms(d.rooms || []);
    setBases({ publicBase: d.publicBase, whipBase: d.whipBase });
  }, [onSignOut]);

  useEffect(() => {
    load();
  }, [load]);

  const call = async (init: RequestInit, url = '/api/admin/rooms') => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(url, init);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'request failed');
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const create = (room: string, opts: Record<string, unknown> = {}) =>
    call({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ room, ...opts }),
    });

  const endSession = (room: string) =>
    call({
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ room }),
    });

  const remove = (room: string) =>
    call({ method: 'DELETE' }, `/api/admin/rooms?room=${encodeURIComponent(room)}`);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <h2 style={{ marginBottom: '0.25rem' }}>Sessions</h2>
          <p style={{ marginTop: 0, color: '#888' }}>
            Signed in as <strong>{me.username}</strong>
            {me.role === 'admin' ? ' (admin)' : ''}
          </p>
        </div>
        <button className="lk-button" style={small} onClick={onSignOut}>
          sign out
        </button>
      </div>

      <form
        className="cs-admin-create"
        style={{ margin: '1.5rem 0' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (newRoom.trim()) {
            create(newRoom);
            setNewRoom('');
          }
        }}
      >
        <input
          value={newRoom}
          onChange={(e) => setNewRoom(e.target.value)}
          placeholder="Session name"
        />
        <button className="lk-button" type="submit" disabled={busy || !newRoom.trim()}>
          {busy ? 'Working…' : 'Create'}
        </button>
      </form>

      {me.role !== 'admin' && (
        <p style={{ color: '#666', fontSize: '0.8rem', marginTop: '-0.75rem' }}>
          {rooms.length} of 2 sessions used
        </p>
      )}
      {err && <p style={{ color: '#f87171' }}>{err}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {rooms.length === 0 && <p style={{ color: '#666' }}>No sessions yet.</p>}
        {rooms.map((r) => {
          const isPending = pending && pending.endsWith(`:${r.room}`);
          return (
            <div key={r.room} style={box}>
              <div className="cs-admin-head">
                <span>
                  <strong>{r.room}</strong>
                  {r.live ? (
                    <span style={{ marginLeft: '0.6rem', fontSize: '0.75rem', color: '#4ade80' }}>
                      ● live · {r.live.participants} in room
                      {r.live.publishers > 0 ? ` · ${r.live.publishers} publishing` : ''}
                    </span>
                  ) : (
                    <span style={{ marginLeft: '0.6rem', fontSize: '0.75rem', color: '#666' }}>
                      idle
                    </span>
                  )}
                  {me.role === 'admin' && r.owner && (
                    <span style={{ marginLeft: '0.6rem', fontSize: '0.75rem', color: '#8A9DB5' }}>
                      {r.owner}
                    </span>
                  )}
                </span>
                <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {isPending ? (
                    <>
                      <button
                        className="lk-button"
                        style={danger}
                        onClick={() => {
                          if (pending!.startsWith('end:')) endSession(r.room);
                          else if (pending!.startsWith('key:')) create(r.room, { rotateKey: true });
                          else remove(r.room);
                        }}
                      >
                        Confirm
                      </button>
                      <button className="lk-button" style={small} onClick={() => setPending(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="lk-button"
                        style={small}
                        onClick={() => setPending(`end:${r.room}`)}
                      >
                        end session
                      </button>
                      <button
                        className="lk-button"
                        style={small}
                        onClick={() => create(r.room, { rotate: true })}
                      >
                        new passphrase
                      </button>
                      <button
                        className="lk-button"
                        style={small}
                        onClick={() => setPending(`key:${r.room}`)}
                      >
                        new stream key
                      </button>
                      <button
                        className="lk-button"
                        style={small}
                        onClick={() => setPending(`del:${r.room}`)}
                      >
                        delete
                      </button>
                    </>
                  )}
                </span>
              </div>

              <Row label="Join link" value={`${bases.publicBase}/rooms/${r.room}`} />
              <Row label="Passphrase" value={r.passphrase} />
              {r.streamKey && <Row label="OBS server" value={`${bases.whipBase}/${r.streamKey}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
