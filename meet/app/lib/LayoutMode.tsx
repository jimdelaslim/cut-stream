'use client';

import * as React from 'react';

type Mode = 'grid' | 'focus' | 'cinema';
const STORAGE_KEY = 'layout-mode';
const ORDER: Mode[] = ['grid', 'focus', 'cinema'];
const LABEL: Record<Mode, string> = { grid: 'Grid', focus: 'Focus', cinema: 'Cinema' };

export function LayoutMode() {
  const [mode, setMode] = React.useState<Mode>(() => {
    if (typeof window === 'undefined') return 'focus';
    return (window.localStorage.getItem(STORAGE_KEY) as Mode) || 'focus';
  });

  React.useEffect(() => {
    const el = document.querySelector('.lk-room-container');
    if (!el) return;
    el.setAttribute('data-layout', mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const next = () => setMode(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]);

  return (
    <button
      onClick={next}
      title="Change layout"
      style={{
        position: 'absolute',
        bottom: '1.1rem',
        left: '1rem',
        zIndex: 20,
        background: 'rgba(15,27,46,0.88)',
        border: '1px solid #2c3138',
        borderRadius: 8,
        padding: '0.45rem 0.7rem',
        color: '#EDF3FA',
        fontSize: '0.8rem',
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
      }}
    >
      {LABEL[mode]}
    </button>
  );
}
