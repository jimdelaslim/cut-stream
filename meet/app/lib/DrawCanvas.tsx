'use client';

import * as React from 'react';
import { useRoomContext } from '@livekit/components-react';
import { DataPacket_Kind, RoomEvent, type RemoteParticipant } from 'livekit-client';
import { useHostInfo } from '@/lib/useHostInfo';

/** Points are stored 0..1 so a stroke lands in the same place on any screen. */
type Point = { x: number; y: number };
export type Stroke = { id: string; author: string; colour: string; points: Point[] };

type Msg =
  | { t: 'stroke'; stroke: Stroke }
  | { t: 'clearMine'; author: string }
  | { t: 'clearAll' }
  | { t: 'sync?'; }
  | { t: 'sync!'; strokes: Stroke[] };

const PALETTE = ['#4DA3FF', '#FF5D5D', '#4ADE80', '#FACC15', '#C084FC', '#FB923C'];

function colourFor(identity: string): string {
  let h = 0;
  for (let i = 0; i < identity.length; i++) h = (h * 31 + identity.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function DrawCanvas({ active }: { active: boolean }) {
  const room = useRoomContext();
  const { iAmOwner } = useHostInfo();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = React.useState<Stroke[]>([]);
  const drawing = React.useRef<Stroke | null>(null);
  const me = room.localParticipant.identity;
  const myColour = colourFor(me);

  const publish = React.useCallback(
    (msg: Msg) => {
      room.localParticipant
        .publishData(encoder.encode(JSON.stringify(msg)), { reliable: true })
        .catch(() => {});
    },
    [room],
  );

  // --- receive ---
  React.useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant) => {
      let msg: Msg;
      try {
        msg = JSON.parse(decoder.decode(payload));
      } catch {
        return;
      }
      if (msg.t === 'stroke') {
        setStrokes((s) => (s.some((x) => x.id === msg.stroke.id) ? s : [...s, msg.stroke]));
      } else if (msg.t === 'clearMine') {
        setStrokes((s) => s.filter((x) => x.author !== msg.author));
      } else if (msg.t === 'clearAll') {
        setStrokes([]);
      } else if (msg.t === 'sync?') {
        // Someone just joined; anyone who has strokes answers.
        setStrokes((s) => {
          if (s.length) publish({ t: 'sync!', strokes: s });
          return s;
        });
      } else if (msg.t === 'sync!') {
        setStrokes((s) => (s.length ? s : msg.strokes));
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, publish]);

  // Ask for existing strokes on join.
  React.useEffect(() => {
    const t = setTimeout(() => publish({ t: 'sync?' }), 800);
    return () => clearTimeout(t);
  }, [publish]);

  // --- render ---
  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (c.width !== rect.width * dpr || c.height !== rect.height * dpr) {
        c.width = rect.width * dpr;
        c.height = rect.height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;

      const all = drawing.current ? [...strokes, drawing.current] : strokes;
      for (const s of all) {
        if (s.points.length < 2) continue;
        ctx.strokeStyle = s.colour;
        ctx.beginPath();
        ctx.moveTo(s.points[0].x * rect.width, s.points[0].y * rect.height);
        for (const p of s.points.slice(1)) ctx.lineTo(p.x * rect.width, p.y * rect.height);
        ctx.stroke();
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [strokes]);

  // --- input ---
  const pos = (e: React.PointerEvent): Point => {
    const r = (e.target as HTMLElement).getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!active) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawing.current = {
      id: `${me}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      author: me,
      colour: myColour,
      points: [pos(e)],
    };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    drawing.current.points.push(pos(e));
    setStrokes((s) => [...s]); // nudge a repaint
  };

  const onUp = () => {
    const s = drawing.current;
    drawing.current = null;
    if (!s || s.points.length < 2) return;
    setStrokes((prev) => [...prev, s]);
    publish({ t: 'stroke', stroke: s });
  };

  const clearMine = () => {
    setStrokes((s) => s.filter((x) => x.author !== me));
    publish({ t: 'clearMine', author: me });
  };

  const clearAll = () => {
    setStrokes([]);
    publish({ t: 'clearAll' });
  };

  const mine = strokes.some((s) => s.author === me);

  return (
    <>
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: 'transparent',
          zIndex: 5,
          touchAction: 'none',
          cursor: active ? 'crosshair' : 'default',
          pointerEvents: active ? 'auto' : 'none',
        }}
      />
      {(mine || (iAmOwner && strokes.length > 0)) && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 6,
            display: 'flex',
            gap: '0.35rem',
          }}
        >
          {mine && (
            <button className="lk-button" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }} onClick={clearMine}>
              clear mine
            </button>
          )}
          {iAmOwner && strokes.length > 0 && (
            <button className="lk-button" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }} onClick={clearAll}>
              clear all
            </button>
          )}
        </div>
      )}
    </>
  );
}
