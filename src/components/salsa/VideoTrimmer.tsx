import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoTrimmerProps {
  /** Object URL or blob URL of the selected file */
  src: string;
  /** Called when user confirms trim points (null = no trim) */
  onTrimChange: (trimStart: number | null, trimEnd: number | null) => void;
}

function fmt(s: number): string {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function VideoTrimmer({ src, onTrimChange }: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Trim handles as fraction 0–1
  const [startFrac, setStartFrac] = useState(0);
  const [endFrac, setEndFrac] = useState(1);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  // Load duration
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    function onMeta() {
      if (v) {
        setDuration(v.duration);
        setStartFrac(0);
        setEndFrac(1);
        onTrimChange(null, null);
      }
    }
    function onTime() { if (v) setCurrentTime(v.currentTime); }
    function onPlay() { setPlaying(true); }
    function onPause() { setPlaying(false); }
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [src]);

  // Loop between trim points during playback
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const endTime = endFrac * duration;
    function onTime() {
      if (v && v.currentTime >= endTime) {
        v.currentTime = startFrac * duration;
      }
    }
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [duration, startFrac, endFrac]);

  // Emit trim changes
  useEffect(() => {
    if (!duration) return;
    const isTrimmed = startFrac > 0.005 || endFrac < 0.995;
    if (isTrimmed) {
      onTrimChange(
        Math.round(startFrac * duration * 100) / 100,
        Math.round(endFrac * duration * 100) / 100,
      );
    } else {
      onTrimChange(null, null);
    }
  }, [startFrac, endFrac, duration]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < startFrac * duration || v.currentTime >= endFrac * duration) {
        v.currentTime = startFrac * duration;
      }
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [startFrac, endFrac, duration]);

  // Pointer drag for handles
  const handlePointerDown = useCallback((handle: 'start' | 'end', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(handle);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    if (dragging === 'start') {
      const newStart = Math.min(frac, endFrac - 0.02);
      setStartFrac(Math.max(0, newStart));
      if (videoRef.current) videoRef.current.currentTime = Math.max(0, newStart) * duration;
    } else {
      const newEnd = Math.max(frac, startFrac + 0.02);
      setEndFrac(Math.min(1, newEnd));
      if (videoRef.current) videoRef.current.currentTime = Math.min(1, newEnd) * duration;
    }
  }, [dragging, startFrac, endFrac, duration]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const trimmedDuration = duration > 0 ? (endFrac - startFrac) * duration : 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Video preview */}
      <div className="relative rounded-lg overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={src}
          className="w-full max-h-48 object-contain"
          preload="metadata"
          playsInline
          muted
          onClick={togglePlay}
        />
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
              <Play size={16} className="text-white ml-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Trim timeline */}
      <div className="px-1">
        <div className="flex items-center gap-2 mb-1">
          <Scissors size={12} className="text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Glisser les poignées pour couper le début / la fin
          </span>
        </div>

        <div
          ref={trackRef}
          className="relative h-10 select-none touch-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Full track background */}
          <div className="absolute inset-x-0 top-3 h-4 bg-gray-200 dark:bg-gray-700 rounded-sm" />

          {/* Dimmed left (trimmed out) */}
          <div
            className="absolute top-3 h-4 bg-gray-400/50 dark:bg-gray-600/50 rounded-l-sm"
            style={{ left: 0, width: `${startFrac * 100}%` }}
          />

          {/* Dimmed right (trimmed out) */}
          <div
            className="absolute top-3 h-4 bg-gray-400/50 dark:bg-gray-600/50 rounded-r-sm"
            style={{ left: `${endFrac * 100}%`, right: 0 }}
          />

          {/* Selected region */}
          <div
            className="absolute top-3 h-4 bg-primary/20 border-y-2 border-primary/40"
            style={{
              left:  `${startFrac * 100}%`,
              width: `${(endFrac - startFrac) * 100}%`,
            }}
          />

          {/* Playhead */}
          <div
            className="absolute top-2 w-0.5 h-6 bg-white shadow-sm pointer-events-none z-10"
            style={{ left: `${progress}%` }}
          />

          {/* Start handle */}
          <div
            className={cn(
              'absolute top-1 w-4 h-8 -ml-2 rounded cursor-ew-resize z-20 flex items-center justify-center transition-colors',
              dragging === 'start' ? 'bg-green-500' : 'bg-green-500/80 hover:bg-green-500',
            )}
            style={{ left: `${startFrac * 100}%` }}
            onPointerDown={e => handlePointerDown('start', e)}
          >
            <div className="w-0.5 h-3 bg-white/70 rounded-full" />
          </div>

          {/* End handle */}
          <div
            className={cn(
              'absolute top-1 w-4 h-8 -ml-2 rounded cursor-ew-resize z-20 flex items-center justify-center transition-colors',
              dragging === 'end' ? 'bg-red-500' : 'bg-red-500/80 hover:bg-red-500',
            )}
            style={{ left: `${endFrac * 100}%` }}
            onPointerDown={e => handlePointerDown('end', e)}
          >
            <div className="w-0.5 h-3 bg-white/70 rounded-full" />
          </div>
        </div>

        {/* Time labels */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono mt-0.5">
          <span className="text-green-600 font-medium">{fmt(startFrac * duration)}</span>
          <span>Durée : {fmt(trimmedDuration)}</span>
          <span className="text-red-600 font-medium">{fmt(endFrac * duration)}</span>
        </div>
      </div>
    </div>
  );
}
