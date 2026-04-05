import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Repeat, X, Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  title?: string;
  /** If set, playback starts at this time (seconds) */
  trimStart?: number | null;
  /** If set, playback loops/stops at this time (seconds) */
  trimEnd?: number | null;
}

function formatTime(s: number): string {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function VideoPlayer({ src, title, trimStart, trimEnd }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loopFull, setLoopFull] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A/B loop points (in seconds)
  const [pointA, setPointA] = useState<number | null>(null);
  const [pointB, setPointB] = useState<number | null>(null);

  // ── Playback controls ────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, []);

  const restart = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = pointA ?? trimStart ?? 0;
    v.play().catch(() => {});
    setPlaying(true);
  }, [pointA, trimStart]);

  // ── Speed slider ────────────────────────────────────────────────────────

  const changeSpeed = useCallback((s: number) => {
    const rounded = Math.round(s * 100) / 100;
    setSpeed(rounded);
    if (videoRef.current) videoRef.current.playbackRate = rounded;
  }, []);

  const resetSpeed = useCallback(() => {
    setSpeed(1);
    if (videoRef.current) videoRef.current.playbackRate = 1;
  }, []);

  // ── Fullscreen ──────────────────────────────────────────────────────────

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      try {
        await el.requestFullscreen();
      } catch {}
    } else {
      try {
        await document.exitFullscreen();
      } catch {}
    }
  }, []);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Auto-hide controls in fullscreen ────────────────────────────────────

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isFullscreen) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (isFullscreen) {
      resetHideTimer();
    } else {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
  }, [isFullscreen, resetHideTimer]);

  // ── A/B loop ──────────────────────────────────────────────────────────────

  const setA = useCallback(() => {
    if (videoRef.current) setPointA(videoRef.current.currentTime);
  }, []);

  const setB = useCallback(() => {
    if (!videoRef.current) return;
    const bTime = videoRef.current.currentTime;
    // If B <= A, swap so A is always before B
    if (pointA !== null && bTime <= pointA) {
      setPointB(pointA);
      setPointA(bTime);
    } else {
      setPointB(bTime);
    }
  }, [pointA]);

  const clearAB = useCallback(() => {
    setPointA(null);
    setPointB(null);
  }, []);

  // ── Seek to trimStart on load ───────────────────────────────────────────
  const effectiveTrimStart = trimStart ?? null;
  const effectiveTrimEnd = trimEnd ?? null;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !effectiveTrimStart) return;

    // If metadata is already loaded, seek immediately
    if (v.readyState >= 1) {
      v.currentTime = effectiveTrimStart;
      return;
    }

    function onLoaded() { if (v && effectiveTrimStart) v.currentTime = effectiveTrimStart; }
    v.addEventListener('loadedmetadata', onLoaded);
    return () => v.removeEventListener('loadedmetadata', onLoaded);
  }, [src, effectiveTrimStart]);

  // ── Keyboard controls ──────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onKeyDown(e: KeyboardEvent) {
      const v = videoRef.current;
      if (!v) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          v.currentTime = Math.max(effectiveTrimStart ?? 0, v.currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          v.currentTime = Math.min(effectiveTrimEnd ?? v.duration, v.currentTime + 5);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    }

    container.addEventListener('keydown', onKeyDown);
    return () => container.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, toggleFullscreen, effectiveTrimStart, effectiveTrimEnd]);

  // ── Time update & A/B loop enforcement ─────────────────────────────────

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const hasAB = pointA !== null && pointB !== null;
    const hasTrim = effectiveTrimStart !== null || effectiveTrimEnd !== null;
    v.loop = loopFull && !hasAB && !hasTrim;

    function onTimeUpdate() {
      if (!v) return;
      setCurrentTime(v.currentTime);
      // A/B loop takes priority
      if (pointA !== null && pointB !== null && v.currentTime >= pointB) {
        v.currentTime = pointA;
        return;
      }
      // Trim end enforcement
      if (effectiveTrimEnd !== null && v.currentTime >= effectiveTrimEnd) {
        if (loopFull) {
          v.currentTime = effectiveTrimStart ?? 0;
        } else {
          v.pause();
        }
      }
    }

    function onLoadedMetadata() {
      if (v) setDuration(v.duration);
    }

    function onEnded() {
      if (pointA !== null && pointB !== null) {
        if (v) { v.currentTime = pointA; v.play().catch(() => {}); }
      } else if (loopFull) {
        if (v) { v.currentTime = effectiveTrimStart ?? 0; v.play().catch(() => {}); }
      } else {
        setPlaying(false);
      }
    }

    function onPlay() { setPlaying(true); }
    function onPause() { setPlaying(false); }

    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('loadedmetadata', onLoadedMetadata);
    v.addEventListener('ended', onEnded);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);

    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [loopFull, pointA, pointB, effectiveTrimStart, effectiveTrimEnd]);

  // ── Seek via progress bar (clamped to trim region) ────────────────────

  function seekTo(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    let target = ratio * duration;

    // Clamp seek to trim/AB region
    const minTime = pointA ?? effectiveTrimStart ?? 0;
    const maxTime = pointB ?? effectiveTrimEnd ?? duration;
    target = Math.max(minTime, Math.min(maxTime, target));

    v.currentTime = target;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const abActive = pointA !== null && pointB !== null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn(
        'rounded-xl overflow-hidden bg-black outline-none',
        isFullscreen && 'flex flex-col h-screen w-screen',
        isFullscreen && !controlsVisible && 'cursor-none',
      )}
      onMouseMove={isFullscreen ? resetHideTimer : undefined}
      onTouchStart={isFullscreen ? resetHideTimer : undefined}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        className={cn(
          'w-full cursor-pointer',
          isFullscreen ? 'flex-1 min-h-0 object-contain' : 'aspect-video',
        )}
        onClick={togglePlay}
        playsInline
        preload="auto"
      />

      {/* Controls */}
      <div className={cn(
        'px-3 py-2 space-y-2 bg-gradient-to-t from-black/90 to-black/60 transition-opacity duration-300',
        isFullscreen && 'px-6 py-4 space-y-3',
        isFullscreen && !controlsVisible && 'opacity-0 pointer-events-none',
      )}>
        {/* Progress bar */}
        <div
          ref={progressRef}
          className={cn(
            'relative bg-white/20 rounded-full cursor-pointer group',
            isFullscreen ? 'h-3' : 'h-2',
          )}
          onClick={seekTo}
        >
          <div
            className="absolute inset-y-0 left-0 bg-primary rounded-full transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
          {pointA !== null && duration > 0 && (
            <div
              className="absolute top-0 w-0.5 h-full bg-green-400 z-10"
              style={{ left: `${(pointA / duration) * 100}%` }}
              title={`A: ${formatTime(pointA)}`}
            />
          )}
          {pointB !== null && duration > 0 && (
            <div
              className="absolute top-0 w-0.5 h-full bg-red-400 z-10"
              style={{ left: `${(pointB / duration) * 100}%` }}
              title={`B: ${formatTime(pointB)}`}
            />
          )}
          {abActive && duration > 0 && (
            <div
              className="absolute inset-y-0 bg-primary/20 rounded-full"
              style={{
                left:  `${(pointA! / duration) * 100}%`,
                width: `${((pointB! - pointA!) / duration) * 100}%`,
              }}
            />
          )}
        </div>

        {/* Main controls row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Play/Pause */}
          <button onClick={togglePlay} className="p-1.5 rounded-lg text-white hover:bg-white/10 transition-colors">
            {playing ? <Pause size={isFullscreen ? 22 : 16} /> : <Play size={isFullscreen ? 22 : 16} />}
          </button>

          {/* Restart */}
          <button onClick={restart} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Recommencer">
            <RotateCcw size={isFullscreen ? 18 : 14} />
          </button>

          {/* Time display */}
          <span className={cn(
            'text-white/70 font-mono tabular-nums',
            isFullscreen ? 'text-sm' : 'text-xs',
          )}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Speed slider with reset */}
          <div className="flex items-center gap-2">
            <button
              onClick={resetSpeed}
              className={cn(
                'font-mono tabular-nums min-w-[3ch] text-right px-1 rounded transition-colors',
                isFullscreen ? 'text-sm' : 'text-xs',
                speed !== 1
                  ? 'text-amber-400 hover:bg-white/10 cursor-pointer'
                  : 'text-white/80',
              )}
              title="Réinitialiser à 1x"
            >
              {speed.toFixed(2)}x
            </button>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              value={speed}
              onChange={e => changeSpeed(Number(e.target.value))}
              className="w-20 h-1 accent-primary cursor-pointer"
              title={`Vitesse: ${speed.toFixed(2)}x`}
            />
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>

        {/* A/B loop row */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={setA}
            className={cn(
              'px-2 py-0.5 rounded text-xs font-mono transition-all',
              pointA !== null
                ? 'bg-green-600/80 text-white font-semibold'
                : 'text-white/50 hover:text-white bg-white/10 hover:bg-white/15',
            )}
            title="Définir le point A (début de boucle)"
          >
            A {pointA !== null ? formatTime(pointA) : ''}
          </button>
          <button
            onClick={setB}
            className={cn(
              'px-2 py-0.5 rounded text-xs font-mono transition-all',
              pointB !== null
                ? 'bg-red-600/80 text-white font-semibold'
                : 'text-white/50 hover:text-white bg-white/10 hover:bg-white/15',
            )}
            title="Définir le point B (fin de boucle)"
          >
            B {pointB !== null ? formatTime(pointB) : ''}
          </button>
          {(pointA !== null || pointB !== null) && (
            <button
              onClick={clearAB}
              className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              title="Effacer A/B"
            >
              <X size={12} />
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => setLoopFull(v => !v)}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              loopFull || abActive
                ? 'text-primary hover:bg-white/10'
                : 'text-white/40 hover:text-white hover:bg-white/10',
            )}
            title={loopFull ? 'Boucle activée' : 'Boucle désactivée'}
          >
            <Repeat size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
