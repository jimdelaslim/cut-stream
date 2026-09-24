'use client';

import * as React from 'react';
import {
  CarouselLayout,
  Chat,
  ConnectionStateToast,
  ControlBar,
  FocusLayout,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
  TrackLoop,
  useCreateLayoutContext,
  useMaybeTrackRefContext,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { FeedVolume } from '@/lib/FeedVolume';
import { useHostInfo } from '@/lib/useHostInfo';
import { DrawCanvas } from '@/lib/DrawCanvas';

const FEED_IDENTITY = 'edit-suite';
const STORAGE_KEY = 'layout-mode';

type Mode = 'cinema' | 'focus' | 'grid';
const ORDER: Mode[] = ['focus', 'cinema', 'grid'];
const LABEL: Record<Mode, string> = { focus: 'Hybrid', cinema: 'Stream', grid: 'Grid' };

const ICON: Record<Mode, React.ReactNode> = {
  focus: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  cinema: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="7" y1="4" x2="7" y2="20" />
      <line x1="17" y1="4" x2="17" y2="20" />
      <line x1="2" y1="9" x2="7" y2="9" />
      <line x1="2" y1="15" x2="7" y2="15" />
      <line x1="17" y1="9" x2="22" y2="9" />
      <line x1="17" y1="15" x2="22" y2="15" />
    </svg>
  ),
  grid: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
};

const pill: React.CSSProperties = {
  background: 'rgba(15,27,46,0.88)',
  border: '1px solid #2c3138',
  borderRadius: 8,
  padding: '0.45rem 0.7rem',
  color: '#EDF3FA',
  fontSize: '0.8rem',
  cursor: 'pointer',
  backdropFilter: 'blur(6px)',
};

function useCompact(): boolean {
  const [compact, setCompact] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 1100px), (max-height: 600px)');
    const on = () => setCompact(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return compact;
}

function peopleTileHeight(count: number, hasFeed: boolean): number {
  if (!hasFeed) {
    if (count <= 2) return 200;
    if (count <= 4) return 175;
    if (count <= 6) return 150;
    return 130;
  }
  if (count <= 3) return 165;
  if (count <= 5) return 135;
  return 110;
}

/** ParticipantTile plus a host badge when this participant owns the room. */
function HostTile() {
  const trackRef = useMaybeTrackRefContext();
  const { ownerIdentity } = useHostInfo();
  const isHost = Boolean(ownerIdentity && trackRef?.participant.identity === ownerIdentity);

  return (
    <div className="cs-tile-wrap" style={{ position: 'relative' }}>
      <ParticipantTile />
      {isHost && (
        <span
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            zIndex: 3,
            background: 'rgba(77,163,255,0.92)',
            color: '#08121f',
            fontSize: '0.62rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            padding: '0.1rem 0.35rem',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        >
          HOST
        </span>
      )}
    </div>
  );
}

function WaitingForFeed() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#5b6875',
        fontSize: '0.95rem',
      }}
    >
      Waiting on stream source
    </div>
  );
}

export function ReviewRoom() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const layoutContext = useCreateLayoutContext();
  const room = useRoomContext();
  const compact = useCompact();
  const [mode, setMode] = React.useState<Mode>(() => {
    if (typeof window === 'undefined') return 'focus';
    return (window.localStorage.getItem(STORAGE_KEY) as Mode) || 'focus';
  });
  const [isFull, setIsFull] = React.useState(false);
  const [canFullscreen, setCanFullscreen] = React.useState(true);
  const [drawing, setDrawing] = React.useState(false);

  React.useEffect(() => {
    // iOS Safari only allows fullscreen on <video>, not arbitrary elements.
    setCanFullscreen(
      typeof document !== 'undefined' &&
        Boolean(document.fullscreenEnabled) &&
        typeof document.documentElement.requestFullscreen === 'function',
    );
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  React.useEffect(() => {
    const onChange = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen();
  };

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const feed = tracks.find((t) => t.participant.identity === FEED_IDENTITY);

  // A participant sharing their screen takes the stage, same as the OBS feed.
  const share = tracks.find(
    (t) =>
      t.source === Track.Source.ScreenShare && t.participant.identity !== FEED_IDENTITY,
  );
  const onStage = feed ?? share;

  const iAmSharing = room.localParticipant.isScreenShareEnabled;
  const someoneElseSharing = Boolean(share) && !iAmSharing;
  const sharerName = share?.participant.name || share?.participant.identity || 'Someone';
  const shareBlocked = Boolean(feed) || someoneElseSharing;
  const shareTitle = feed
    ? 'Admin currently streaming'
    : someoneElseSharing
      ? `${sharerName} is currently screen sharing`
      : iAmSharing
        ? 'Stop sharing'
        : 'Share your screen';

  const others = tracks.filter(
    (t) => t.participant.identity !== FEED_IDENTITY && t !== share,
  );
  const stage = (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {onStage ? <FocusLayout trackRef={onStage} /> : <WaitingForFeed />}
      <DrawCanvas active={drawing} />
    </div>
  );
  const showChat = Boolean(layoutContext.widget.state?.showChat);

  return (
    <LayoutContextProvider value={layoutContext}>
      <div
        ref={containerRef}
        className="lk-room-container"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background: '#0b0f16',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
            {mode === 'grid' && (
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 12,
                  padding: 12,
                  overflow: 'hidden',
                }}
              >
                <div
                  className="cs-people"
                  style={{ ['--tile-h' as any]: `${peopleTileHeight(others.length, Boolean(onStage))}px` }}
                >
                  <TrackLoop tracks={others}>
                    <HostTile />
                  </TrackLoop>
                </div>
                {onStage && (
                  <div className="cs-stage cs-grid-stage" style={{ position: 'relative' }}>
                    <FocusLayout trackRef={onStage} />
                    <DrawCanvas active={drawing} />
                  </div>
                )}
              </div>
            )}

            {mode === 'cinema' && (
              <div className="cs-stage" style={{ flex: 1, minWidth: 0, display: 'flex' }}>
                {stage}
              </div>
            )}

            {mode === 'focus' && (
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: compact ? 'column' : 'row',
                  overflow: 'hidden',
                }}
              >
                {others.length > 0 && (
                  <div
                    className="cs-carousel"
                    style={
                      compact
                        ? { height: 84, flexShrink: 0, overflow: 'hidden' }
                        : { width: 150, flexShrink: 0, overflow: 'hidden' }
                    }
                  >
                    <CarouselLayout
                      tracks={others}
                      orientation={compact ? 'horizontal' : 'vertical'}
                    >
                      <ParticipantTile />
                    </CarouselLayout>
                  </div>
                )}
                <div className="cs-stage" style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>
                  {stage}
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              width: showChat ? (compact ? '100%' : 320) : 0,
              position: compact && showChat ? 'absolute' : 'relative',
              inset: compact && showChat ? 0 : undefined,
              zIndex: compact && showChat ? 50 : undefined,
              background: '#0b0f16',
              flexShrink: 0,
              overflow: 'hidden',
              borderLeft: showChat ? '1px solid #1d2532' : 'none',
            }}
          >
            <Chat style={{ display: showChat ? 'grid' : 'none', height: '100%' }} />
          </div>
        </div>

        <div
          className="cs-controls"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.5rem',
          }}
        >
          <div style={{ position: 'absolute', left: '1rem', display: 'flex', gap: '0.4rem' }}>
            {ORDER.map((m) => (
              <button
                key={m}
                style={{
                  ...pill,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: mode === m ? 'rgba(120,135,155,0.28)' : 'rgba(15,27,46,0.88)',
                  borderColor: '#2c3138',
                  color: mode === m ? '#EDF3FA' : '#8A9DB5',
                }}
                onClick={() => setMode(m)}
                title={LABEL[m]}
              >
                {ICON[m]}
                {LABEL[m]}
              </button>
            ))}
            {canFullscreen && (
              <button style={pill} onClick={toggleFullscreen} title="Fullscreen">
                {isFull ? 'Exit full screen' : 'Full screen'}
              </button>
            )}
          </div>

          <div className="cs-control-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ControlBar controls={{ chat: true, screenShare: false, leave: true }} />
            {!compact && (
            <button
              className="lk-button"
              disabled={shareBlocked}
              aria-pressed={iAmSharing}
              title={shareTitle}
              style={{
                opacity: shareBlocked ? 0.45 : 1,
                cursor: shareBlocked ? 'not-allowed' : 'pointer',
              }}
              onClick={() => {
                if (shareBlocked) return;
                const lp = room.localParticipant;
                lp.setScreenShareEnabled(!lp.isScreenShareEnabled).catch(() => {});
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              Share screen
            </button>
            )}

            <button
              className="lk-button"
              aria-pressed={drawing}
              onClick={() => setDrawing((d) => !d)}
              title={drawing ? 'Stop drawing' : 'Draw on the picture'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
              </svg>
              Draw
            </button>
          </div>

          <div
            style={
              compact
                ? { order: 99, width: '100%', display: 'flex', justifyContent: 'center' }
                : { position: 'absolute', right: '1rem' }
            }
          >
            <FeedVolume compact={compact} />
          </div>
        </div>

        <RoomAudioRenderer />
        <ConnectionStateToast />
      </div>
    </LayoutContextProvider>
  );
}
