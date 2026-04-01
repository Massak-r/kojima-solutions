import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Play, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RhythmVideo {
  title: string;
  youtubeId: string;
}

interface RhythmCategory {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

const RHYTHMS: RhythmCategory[] = [
  // Rumba
  { id: 'guaguanco', label: 'Guaguancó', emoji: '🥁', description: '' },
  { id: 'yambu',     label: 'Yambú',     emoji: '🎶', description: '' },
  { id: 'columbia',  label: 'Columbia',   emoji: '⚡', description: '' },
  // Orishas
  { id: 'chango',  label: 'Changó',  emoji: '🔥', description: 'Feu, tonnerre et danse' },
  { id: 'yemaya',  label: 'Yemayá',  emoji: '🌊', description: 'Mer et maternité' },
  { id: 'eleggua', label: 'Elegguá', emoji: '🚪', description: 'Chemins et carrefours' },
  { id: 'ochun',   label: 'Ochún',   emoji: '🍯', description: 'Amour et rivières' },
  { id: 'obatala', label: 'Obatalá', emoji: '🤍', description: 'Paix et sagesse' },
];

const STORAGE_KEY = 'kojima-rhythm-videos';

function loadVideos(): Record<string, RhythmVideo[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveVideos(data: Record<string, RhythmVideo[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function extractYoutubeId(url: string): string | null {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // raw ID
  ];
  for (const p of patterns) {
    const m = url.trim().match(p);
    if (m) return m[1];
  }
  return null;
}

function RhythmCard({ rhythm }: { rhythm: RhythmCategory }) {
  const [expanded, setExpanded] = useState(false);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [videos, setVideos] = useState<RhythmVideo[]>([]);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    const all = loadVideos();
    setVideos(all[rhythm.id] || []);
  }, [rhythm.id]);

  const persist = useCallback((updated: RhythmVideo[]) => {
    setVideos(updated);
    const all = loadVideos();
    all[rhythm.id] = updated;
    saveVideos(all);
  }, [rhythm.id]);

  const addVideo = () => {
    const ytId = extractYoutubeId(newUrl);
    if (!ytId) return;
    const title = newTitle.trim() || `Video ${videos.length + 1}`;
    persist([...videos, { title, youtubeId: ytId }]);
    setNewUrl('');
    setNewTitle('');
    setAdding(false);
  };

  const removeVideo = (idx: number) => {
    const updated = videos.filter((_, i) => i !== idx);
    persist(updated);
    if (videos[idx]?.youtubeId === activeVideo) setActiveVideo(null);
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card/50">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-secondary/30 transition-colors"
      >
        <span className="text-base">{rhythm.emoji}</span>
        <div className="flex-1 min-w-0">
          <span className="font-body font-medium text-sm">{rhythm.label}</span>
          {rhythm.description && (
            <span className="text-xs text-muted-foreground ml-2">{rhythm.description}</span>
          )}
        </div>
        {videos.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">{videos.length}</span>
        )}
        {expanded
          ? <ChevronUp size={14} className="text-muted-foreground shrink-0" />
          : <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        }
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Active YouTube embed */}
          {activeVideo && (
            <div className="aspect-video bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${activeVideo}?autoplay=1&rel=0`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="YouTube video"
              />
            </div>
          )}

          {/* Video list */}
          {videos.length > 0 && (
            <div className="divide-y divide-border">
              {videos.map((v, i) => (
                <div
                  key={`${v.youtubeId}-${i}`}
                  className={cn(
                    'flex items-center gap-1 transition-colors',
                    activeVideo === v.youtubeId
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-secondary/30',
                  )}
                >
                  <button
                    onClick={() => setActiveVideo(
                      activeVideo === v.youtubeId ? null : v.youtubeId
                    )}
                    className="flex-1 flex items-center gap-2 px-3 py-2 text-left min-w-0"
                  >
                    <Play
                      size={13}
                      className={cn(
                        'shrink-0',
                        activeVideo === v.youtubeId ? 'text-primary fill-primary' : 'text-muted-foreground',
                      )}
                    />
                    <p className="text-xs font-medium truncate">{v.title}</p>
                  </button>
                  <button
                    onClick={() => removeVideo(i)}
                    className="p-1.5 mr-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    title="Supprimer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {videos.length === 0 && !adding && (
            <p className="text-xs text-muted-foreground text-center py-3">
              Aucune vidéo. Ajoutez un lien YouTube.
            </p>
          )}

          {/* Add form */}
          {adding ? (
            <div className="p-2 space-y-1.5 border-t border-border bg-secondary/20">
              <input
                type="text"
                placeholder="Lien YouTube ou ID"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && addVideo()}
              />
              <input
                type="text"
                placeholder="Titre (optionnel)"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background"
                onKeyDown={e => e.key === 'Enter' && addVideo()}
              />
              <div className="flex gap-1.5">
                <button
                  onClick={addVideo}
                  disabled={!extractYoutubeId(newUrl)}
                  className="flex-1 text-xs px-2 py-1 rounded bg-primary text-primary-foreground disabled:opacity-40"
                >
                  Ajouter
                </button>
                <button
                  onClick={() => { setAdding(false); setNewUrl(''); setNewTitle(''); }}
                  className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors border-t border-border"
            >
              <Plus size={12} />
              Ajouter une vidéo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function RhythmReference() {
  const rumba = RHYTHMS.filter(r => ['guaguanco', 'yambu', 'columbia'].includes(r.id));
  const orisha = RHYTHMS.filter(r => !['guaguanco', 'yambu', 'columbia'].includes(r.id));

  return (
    <div className="p-4 space-y-4">
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Rumba</h4>
        <div className="space-y-2">
          {rumba.map(r => <RhythmCard key={r.id} rhythm={r} />)}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Orishas</h4>
        <div className="space-y-2">
          {orisha.map(r => <RhythmCard key={r.id} rhythm={r} />)}
        </div>
      </div>
    </div>
  );
}
