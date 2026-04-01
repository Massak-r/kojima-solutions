import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Save, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  listChoreography, saveChoreography,
  listCustomCategories, addCustomCategory,
  CHOREO_CATEGORIES,
  type ChoreographyEntry, type ChoreoCategory, type CustomCategory,
} from '@/api/choreography';

// ── Generate default timeline: every 3s from 00:01 to 01:34 (94s) ──

function generateDefaultEntries(): LocalEntry[] {
  const entries: LocalEntry[] = [];
  let order = 1;
  for (let t = 1; t <= 94; t += 3) {
    entries.push({
      localId: crypto.randomUUID(),
      timestamp: t,
      orderNum: order++,
      figure: '',
      category: '',
    });
  }
  return entries;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface LocalEntry {
  localId: string;
  timestamp: number;
  orderNum: number;
  figure: string;
  category: string;
}

// ── Merged category type ──

interface MergedCategory {
  id: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  isCustom?: boolean;
}

const CUSTOM_CAT_STYLE = {
  color: 'text-slate-700',
  bg: 'bg-slate-50',
  border: 'border-slate-200',
};

function mergeCategories(custom: CustomCategory[]): MergedCategory[] {
  const builtIn: MergedCategory[] = CHOREO_CATEGORIES.map(c => ({ ...c }));
  const extras: MergedCategory[] = custom.map(c => ({
    id: `custom_${c.id}`,
    label: c.label,
    ...CUSTOM_CAT_STYLE,
    isCustom: true,
  }));
  return [...builtIn, ...extras];
}

// ── Web Audio API player hook ──
// Uses AudioContext + decodeAudioData instead of <audio> element
// because Chrome 146+ has broken <audio> element loading.

function useWebAudioPlayer(url: string) {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef(0);   // AudioContext.currentTime when playback started
  const offsetRef = useRef(0);      // offset into the buffer (for seek/resume)
  const rafRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(94);

  // Fetch + decode on mount
  useEffect(() => {
    let cancelled = false;
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    fetch(url)
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => {
        if (cancelled) return;
        bufferRef.current = decoded;
        setDuration(decoded.duration);
        setReady(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      ctx.close().catch(() => {});
    };
  }, [url]);

  // Animation frame loop for time tracking
  const tick = useCallback(() => {
    const ctx = ctxRef.current;
    const buffer = bufferRef.current;
    if (!ctx || !buffer) return;

    const elapsed = ctx.currentTime - startedAtRef.current + offsetRef.current;
    if (elapsed >= buffer.duration) {
      // Reached end
      setCurrentTime(0);
      setPlaying(false);
      offsetRef.current = 0;
      sourceRef.current = null;
      return;
    }
    setCurrentTime(elapsed);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback((fromOffset?: number) => {
    const ctx = ctxRef.current;
    const buffer = bufferRef.current;
    if (!ctx || !buffer) return;

    // Resume context if suspended (autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();

    // Stop current source if any
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }

    const offset = fromOffset ?? offsetRef.current;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    source.onended = () => {
      // Only handle natural end (not stop() calls)
      if (sourceRef.current === source) {
        setPlaying(false);
        setCurrentTime(0);
        offsetRef.current = 0;
        sourceRef.current = null;
        cancelAnimationFrame(rafRef.current);
      }
    };

    source.start(0, offset);
    sourceRef.current = source;
    startedAtRef.current = ctx.currentTime;
    offsetRef.current = offset;
    setPlaying(true);
    setCurrentTime(offset);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    // Save current position
    const elapsed = ctx.currentTime - startedAtRef.current + offsetRef.current;
    offsetRef.current = elapsed;

    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }

    cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    setCurrentTime(elapsed);
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) pause();
    else play();
  }, [playing, play, pause]);

  const seekTo = useCallback((sec: number) => {
    const buffer = bufferRef.current;
    if (!buffer) return;
    const clamped = Math.max(0, Math.min(sec, buffer.duration));
    if (playing) {
      play(clamped);
    } else {
      offsetRef.current = clamped;
      setCurrentTime(clamped);
    }
  }, [playing, play]);

  return { ready, playing, currentTime, duration, togglePlay, seekTo };
}

// ── Category selector (mobile-friendly) ──

function CategorySelect({ value, onChange, categories }: {
  value: string;
  onChange: (v: string) => void;
  categories: MergedCategory[];
}) {
  const cat = categories.find(c => c.id === value);

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(
        "w-full text-xs h-9 rounded-md border px-2 font-body appearance-none bg-white",
        cat ? `${cat.color} ${cat.bg} ${cat.border}` : "text-muted-foreground border-border"
      )}
    >
      <option value="" className="text-foreground bg-white">A definir</option>
      {categories.map(c => (
        <option key={c.id} value={c.id} className="text-foreground bg-white">{c.label}</option>
      ))}
    </select>
  );
}

// ── Main component ──

export function ChoreographyEditor({ readOnly }: { readOnly?: boolean }) {
  const { toast } = useToast();
  const activeRowRef = useRef<HTMLDivElement>(null);

  const { ready, playing, currentTime, duration, togglePlay, seekTo } =
    useWebAudioPlayer('/salsa/el-chaca-chaca.mp3');

  const [entries, setEntries] = useState<LocalEntry[]>(generateDefaultEntries);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const allCategories = mergeCategories(customCats);

  // Load from DB
  useEffect(() => {
    Promise.all([listChoreography(), listCustomCategories()])
      .then(([data, cats]) => {
        if (data.length > 0) {
          setEntries(data.map(d => ({
            localId: d.id,
            timestamp: d.timestamp,
            orderNum: d.orderNum,
            figure: d.figure,
            category: d.category,
          })));
        }
        setCustomCats(cats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateEntry = useCallback((localId: string, field: keyof LocalEntry, value: string | number) => {
    if (readOnly) return;
    setEntries(prev => prev.map(e =>
      e.localId === localId ? { ...e, [field]: value } : e
    ));
    setDirty(true);
  }, [readOnly]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = entries.map(e => ({
        timestamp: e.timestamp,
        orderNum: e.orderNum,
        figure: e.figure,
        category: e.category,
      }));
      await saveChoreography(payload);
      setDirty(false);
      toast({ title: 'Sauvegarde !' });
    } catch {
      toast({ title: 'Erreur de sauvegarde', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [entries, toast]);

  const handleAddCategory = useCallback(async () => {
    const label = newCatLabel.trim();
    if (!label) return;
    setAddingCat(true);
    try {
      const cat = await addCustomCategory(label);
      setCustomCats(prev => [...prev, cat]);
      setNewCatLabel('');
      setShowAddCat(false);
      toast({ title: `Categorie "${label}" ajoutee` });
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setAddingCat(false);
    }
  }, [newCatLabel, toast]);

  // Find the active row based on current audio time
  const activeTimestamp = entries.reduce((best, e) =>
    currentTime >= e.timestamp ? e.timestamp : best, entries[0]?.timestamp ?? 0
  );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Music Player ── */}
      <div className="bg-gray-900 rounded-xl p-4 space-y-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={!ready}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0",
              ready
                ? "bg-white/10 hover:bg-white/20"
                : "bg-white/5 cursor-not-allowed"
            )}
          >
            {!ready ? (
              <Loader2 size={16} className="text-white/40 animate-spin" />
            ) : playing ? (
              <Pause size={18} className="text-white" />
            ) : (
              <Play size={18} className="text-white ml-0.5" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">El Chaca Chaca 100%</p>
            <p className="text-white/40 text-xs font-body">
              {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          </div>
          {!readOnly && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="h-8 text-xs gap-1 shrink-0"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Sauver
            </Button>
          )}
        </div>

        {/* Progress bar */}
        <div
          className={cn(
            "h-1.5 bg-white/10 rounded-full overflow-hidden",
            ready ? "cursor-pointer" : "cursor-not-allowed"
          )}
          onClick={e => {
            if (!ready) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            seekTo(pct * duration);
          }}
        >
          <div
            className="h-full bg-white/60 rounded-full transition-[width] duration-100"
            style={{ width: `${duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0}%` }}
          />
        </div>
      </div>

      {/* ── Add Category ── */}
      {!readOnly && (
        <div className="flex items-center gap-2 px-1">
          {showAddCat ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={newCatLabel}
                onChange={e => setNewCatLabel(e.target.value)}
                placeholder="Nom de la categorie"
                className="text-xs h-8 flex-1"
                onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }}
                autoFocus
              />
              <Button size="sm" onClick={handleAddCategory} disabled={addingCat || !newCatLabel.trim()} className="h-8 text-xs gap-1">
                {addingCat ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Ajouter
              </Button>
              <button onClick={() => { setShowAddCat(false); setNewCatLabel(''); }} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCat(true)}
              className="text-[10px] font-body text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Plus size={12} />
              Ajouter une categorie
            </button>
          )}
        </div>
      )}

      {/* ── Timeline Rows ── */}
      <div className="space-y-1">
        {entries.map(entry => {
          const isActive = Math.abs(activeTimestamp - entry.timestamp) < 0.5 && playing;
          const cat = allCategories.find(c => c.id === entry.category);

          return (
            <div
              key={entry.localId}
              ref={isActive ? activeRowRef : undefined}
              className={cn(
                "rounded-lg px-2 py-2 transition-colors space-y-1.5",
                isActive
                  ? "bg-gray-900 ring-1 ring-gray-700"
                  : "hover:bg-secondary/30"
              )}
            >
              {/* Row 1: Timestamp + Order */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => seekTo(entry.timestamp)}
                  className={cn(
                    "text-xs font-mono font-semibold rounded-md px-2 py-1 transition-colors",
                    isActive
                      ? "bg-white text-gray-900"
                      : "bg-secondary/60 text-foreground/70 hover:bg-secondary"
                  )}
                >
                  {formatTime(entry.timestamp)}
                </button>
                <span className={cn(
                  "text-xs font-bold tabular-nums",
                  isActive ? "text-white" : "text-muted-foreground"
                )}>
                  #{entry.orderNum}
                </span>
              </div>

              {/* Row 2: Figure */}
              {readOnly ? (
                <p className={cn(
                  "text-sm font-body leading-snug",
                  isActive ? "text-white" : entry.figure ? "text-foreground" : "text-muted-foreground/40"
                )}>
                  {entry.figure || 'A definir'}
                </p>
              ) : (
                <Input
                  value={entry.figure}
                  onChange={e => updateEntry(entry.localId, 'figure', e.target.value)}
                  placeholder="Figure - A definir"
                  className={cn(
                    "text-sm h-9 font-body",
                    isActive && "bg-white/10 text-white border-white/20 placeholder:text-white/30"
                  )}
                />
              )}

              {/* Row 3: Category */}
              {readOnly ? (
                <div>
                  <span className={cn(
                    "inline-block text-xs font-body font-medium px-2.5 py-1 rounded-md",
                    cat ? `${cat.color} ${cat.bg}` : "text-muted-foreground/40 bg-secondary/40"
                  )}>
                    {cat?.label || 'A definir'}
                  </span>
                </div>
              ) : (
                <CategorySelect
                  value={entry.category}
                  onChange={v => updateEntry(entry.localId, 'category', v)}
                  categories={allCategories}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
