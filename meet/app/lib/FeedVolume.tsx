'use client';

import * as React from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent, RemoteParticipant } from 'livekit-client';

const FEED_IDENTITY = 'edit-suite';
const STORAGE_KEY = 'feed-volume';

export function FeedVolume({ compact = false }: { compact?: boolean }) {
  const room = useRoomContext();
  const [present, setPresent] = React.useState(false);
  const [volume, setVolume] = React.useState(() => {
    if (typeof window === 'undefined') return 1;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === null ? 1 : Number(v);
  });

  const findFeed = React.useCallback((): RemoteParticipant | undefined => {
    for (const p of room.remoteParticipants.values()) {
      if (p.identity === FEED_IDENTITY) return p;
    }
    return undefined;
  }, [room]);

  // Apply volume whenever it changes, or the feed (re)appears.
  const apply = React.useCallback(
    (v: number) => {
      const p = findFeed();
      console.log('[FeedVolume] apply', v, 'participant:', p?.identity ?? 'NONE');
      if (p) p.setVolume(v);
    },
    [findFeed],
  );

  React.useEffect(() => {
    const refresh = () => {
      const p = findFeed();
      setPresent(Boolean(p));
      if (p) {
        p.setVolume(volume);
        // The audio element is attached asynchronously after subscription,
        // so set it again once the browser has had a tick to catch up.
        setTimeout(() => p.setVolume(volume), 300);
        setTimeout(() => p.setVolume(volume), 1200);
      }
    };
    refresh();
    room.on(RoomEvent.ParticipantConnected, refresh);
    room.on(RoomEvent.ParticipantDisconnected, refresh);
    room.on(RoomEvent.TrackSubscribed, refresh);
    room.on(RoomEvent.TrackPublished, refresh);
    room.on(RoomEvent.Connected, refresh);
    return () => {
      room.off(RoomEvent.ParticipantConnected, refresh);
      room.off(RoomEvent.ParticipantDisconnected, refresh);
      room.off(RoomEvent.TrackSubscribed, refresh);
      room.off(RoomEvent.TrackPublished, refresh);
      room.off(RoomEvent.Connected, refresh);
    };
  }, [room, findFeed, volume]);

  // iOS ignores programmatic volume and muted on media elements, so the
  // control would render but do nothing. Hardware buttons only there.
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  if (!present || isIOS) return null;

  const muted = volume === 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        background: 'rgba(15,27,46,0.88)',
        border: '1px solid #2c3138',
        borderRadius: 8,
        padding: '0.45rem 0.7rem',
        backdropFilter: 'blur(6px)',
      }}
    >
      <button
        onClick={() => {
          const next = muted ? 1 : 0;
          setVolume(next);
          window.localStorage.setItem(STORAGE_KEY, String(next));
          apply(next);
        }}
        title={muted ? 'Unmute playback stream' : 'Mute playback stream'}
        style={{
          background: 'none',
          border: 'none',
          color: muted ? '#f87171' : '#EDF3FA',
          cursor: 'pointer',
          fontSize: '0.8rem',
          padding: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {muted ? 'Playback muted' : 'Playback Stream'}
      </button>
      {!compact && (
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => {
          const v = Number(e.target.value);
          setVolume(v);
          window.localStorage.setItem(STORAGE_KEY, String(v));
          apply(v);
        }}
        style={{ width: 90 }}
      />
      )}
    </div>
  );
}
