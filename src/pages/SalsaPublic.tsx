import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Bookmark, ExternalLink, Play, X, Plus, ChevronDown, ChevronUp, Music, Check, Pencil, Trash2, Upload, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { validateAccess } from '@/api/salsaAccess';
import { listMoves, createMove, updateMove, deleteMove, type SalsaMoveItem } from '@/api/salsaMoves';
import { listProgress, type ClassProgressItem } from '@/api/classProgress';
import type { SalsaType } from '@/types/salsaMove';
import { ClassColumn } from '@/components/salsa/ClassColumn';
import { VideoPlayer } from '@/components/salsa/VideoPlayer';
import { ChoreographyEditor } from '@/components/salsa/ChoreographyEditor';
import {
  listVideos, uploadVideo, deleteVideo, getVideoUrl,
  type SalsaVideo,
} from '@/api/salsaVideos';
import {
  listPlaylists, createPlaylist, deletePlaylist,
  addToPlaylist, removeFromPlaylist,
  type Playlist,
} from '@/api/playlists';

const TYPE_LABELS: Record<SalsaType, string> = {
  cours:   'Programme de cours',
  figures: 'Figures',
  solo:    'Solo',
};

// "figures" URL now shows both figures + solo
const COMBINED_LABEL = 'Figures & Solo';

const DEFAULT_TOPICS: Record<SalsaType, string[]> = {
  cours:   ['Débutant', 'Intermédiaire', 'Avancé', 'En couple', 'Footwork'],
  figures: ['Setenta', 'Havana', 'Enchufla', 'Dile que no', 'Vacilala', 'Adios'],
  solo:    ['Footwork', 'Body movement', 'Shines', 'Arms', 'Salsa básica'],
};

function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function storageKey(type: SalsaType) { return `kojima-salsa-${type}`; }

// ── Move Card (public) ─────────────────────────────────────────

interface MoveCardProps {
  move:           SalsaMoveItem;
  videos?:        SalsaVideo[];
  inAnyPlaylist:  boolean;
  canPlaylist:    boolean;
  authEmail?:     string | null;
  isAdmin?:       boolean;
  onBookmark:     (id: string) => void;
  onEdit:         (move: SalsaMoveItem) => void;
  onDelete:       (id: string) => void;
  onOpenVideo:    (src: string, title: string, trimStart?: number | null, trimEnd?: number | null) => void;
}

function PublicMoveCard({ move, videos, inAnyPlaylist, canPlaylist, authEmail, isAdmin, onBookmark, onEdit, onDelete, onOpenVideo }: MoveCardProps) {
  const ytId = extractYouTubeId(move.videoUrl);
  const [expanded, setExpanded] = useState(false);
  const [activeVideoIdx, setActiveVideoIdx] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasUploaded = videos && videos.length > 0;
  const activeVideo = hasUploaded ? videos[activeVideoIdx] : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ containerType: 'inline-size' }}>
      {/* Thumbnail / video */}
      {activeVideo ? (
        <div
          className="relative bg-black cursor-pointer overflow-hidden"
          style={{ maxHeight: '100cqi' }}
          onClick={() => onOpenVideo(getVideoUrl(activeVideo.id), move.title, activeVideo.trimStart, activeVideo.trimEnd)}
        >
          <video
            src={getVideoUrl(activeVideo.id)}
            className="w-full object-cover opacity-80"
            preload="metadata"
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
              <Play size={20} className="text-white ml-0.5" />
            </div>
          </div>
          {/* Video switcher dots */}
          {videos!.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm z-10">
              {videos!.map((v, i) => (
                <button
                  key={v.id}
                  onClick={(e) => { e.stopPropagation(); setActiveVideoIdx(i); }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === activeVideoIdx ? 'bg-violet-400 scale-125' : 'bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      ) : ytId ? (
        <div
          className="relative bg-black cursor-pointer overflow-hidden"
          style={{ maxHeight: '100cqi' }}
          onClick={() => onOpenVideo(`youtube:${ytId}`, move.title)}
        >
          <img
            src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
            alt={move.title}
            className="w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
              <Play size={20} className="text-white ml-0.5" />
            </div>
          </div>
        </div>
      ) : (
        <div className="aspect-video bg-gray-900 flex items-center justify-center" style={{ maxHeight: '100cqi' }}>
          <Music className="w-12 h-12 text-gray-600 opacity-30" />
        </div>
      )}

      {/* Content */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm leading-snug">{move.title}</h3>
            {move.difficulty > 0 && (
              <div className="flex gap-0.5 mt-0.5">
                {[1,2,3,4,5].map(n => (
                  <span key={n} className={`text-xs leading-none ${n <= move.difficulty ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Only show edit/delete if user is owner or admin */}
            {(isAdmin || !move.createdBy || (authEmail && move.createdBy === authEmail)) && (
              <>
                <button
                  onClick={() => onEdit(move)}
                  className="text-gray-300 hover:text-gray-600 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {confirmDelete ? (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => { onDelete(move.id); setConfirmDelete(false); }}
                      className="text-[10px] text-red-600 hover:text-red-800 font-medium"
                    >
                      Suppr
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-[10px] text-gray-400 hover:text-gray-600"
                    >
                      Non
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
            {canPlaylist && (
              <button
                onClick={() => onBookmark(move.id)}
                className="text-gray-400 hover:text-violet-600 transition-colors"
              >
                <Bookmark className={`w-4 h-4 ${inAnyPlaylist ? 'fill-violet-600 text-violet-600' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {move.topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {move.topics.map(t => (
              <Badge key={t} variant="secondary" className="text-xs py-0">{t}</Badge>
            ))}
          </div>
        )}

        {move.description && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 self-start"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Masquer' : 'Détails'}
          </button>
        )}
        {expanded && move.description && (
          <p className="text-xs text-gray-600 whitespace-pre-wrap">{move.description}</p>
        )}

        {move.linkUrl && (
          <a
            href={move.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-auto"
          >
            <ExternalLink className="w-3 h-3" /> Lien
          </a>
        )}
      </div>
    </div>
  );
}

// ── Add Move Dialog ──────────────────────────────────────────

interface AddMoveDialogProps {
  type:    SalsaType;
  open:    boolean;
  authEmail?: string | null;
  onClose: () => void;
  onAdded: (move: SalsaMoveItem) => void;
  onVideoUploaded: (moveId: string, video: SalsaVideo) => void;
}

function AddMoveDialog({ type, open, authEmail, onClose, onAdded, onVideoUploaded }: AddMoveDialogProps) {
  const { toast } = useToast();
  const [title,      setTitle]      = useState('');
  const [videoUrl,   setVideoUrl]   = useState('');
  const [linkUrl,    setLinkUrl]    = useState('');
  const [desc,       setDesc]       = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [topics,     setTopics]     = useState<string[]>([]);
  const [saving,     setSaving]     = useState(false);
  // Video file upload
  const [videoFile,  setVideoFile]  = useState<File | null>(null);
  const [uploading,  setUploading]  = useState(false);
  // User-selectable type (figures/solo)
  const [moveType, setMoveType]    = useState<SalsaType>(type);
  useEffect(() => { setMoveType(type); }, [type]);

  // Reset stale flags when dialog opens
  useEffect(() => {
    if (open) {
      setSaving(false);
      setUploading(false);
    }
  }, [open]);

  const effectiveType = moveType;
  const canChooseType = type === 'figures' || type === 'solo';

  const instructions =
    effectiveType === 'figures' ? 'Indique le niveau, la thématique (Setenta, havana etc) et une vidéo avec explication. Merci 🙏' :
    effectiveType === 'solo'    ? 'Les vidéos de dos et avec explications sont préférées 🙏' :
    'Propose un mouvement à ajouter au programme. Indique le niveau et une vidéo si possible. Merci 🙏';

  function addTopic(t: string) {
    const trimmed = t.trim();
    if (trimmed && !topics.includes(trimmed)) setTopics(prev => [...prev, trimmed]);
  }

  function handleFileSelect(f: File | null) {
    if (f) {
      if (f.size > 150 * 1024 * 1024) {
        toast({ title: 'Fichier trop volumineux', description: 'Maximum 150 Mo', variant: 'destructive' });
        return;
      }
      setVideoFile(f);
    } else {
      setVideoFile(null);
    }
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const move = await createMove({
        type: effectiveType,
        title: title.trim(),
        videoUrl:    videoUrl.trim()  || undefined,
        linkUrl:     linkUrl.trim()   || undefined,
        description: desc.trim()      || undefined,
        topics,
        status:    'learning',
        sortOrder: 9999,
        createdBy: authEmail || undefined,
      });

      // Upload video file if selected (transcode .mov etc. for browser compat)
      if (videoFile) {
        setUploading(true);
        try {
          let fileToUpload: File = videoFile;
          const { needsCompression, compressVideo } = await import('@/lib/videoCompress');
          if (needsCompression(videoFile)) {
            fileToUpload = await compressVideo(videoFile);
          }
          const vid = await uploadVideo(move.id, fileToUpload);
          onVideoUploaded(move.id, vid);
        } catch (e: any) {
          toast({ title: 'Erreur upload', description: e.message, variant: 'destructive' });
        }
        setUploading(false);
      }

      toast({ title: 'Ajouté ✓', description: `"${move.title}" a été ajouté.` });
      onAdded(move);
      onClose();
      setTitle(''); setVideoUrl(''); setLinkUrl(''); setDesc(''); setTopics([]);
      handleFileSelect(null);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible d\'ajouter le mouvement.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {effectiveType === 'figures' ? 'Ajouter une figure' : effectiveType === 'solo' ? 'Ajouter une variation solo' : 'Proposer un mouvement'}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {instructions}
        </div>

        <div className="flex flex-col gap-3">
          {canChooseType && (
            <div>
              <Label>Type</Label>
              <div className="flex gap-1 mt-1">
                {(['figures', 'solo'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setMoveType(t); setTopics([]); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      moveType === t ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label>Titre *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nom du mouvement" />
          </div>
          <div>
            <Label>URL vidéo (YouTube)</Label>
            <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="youtube.com/watch?v=..." />
          </div>

          {/* Video file upload */}
          <div className="space-y-2">
            <Label>Ou uploader une vidéo</Label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 hover:border-violet-400 cursor-pointer transition-colors flex-1">
                <Upload size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500 truncate">
                  {videoFile ? videoFile.name : 'Choisir une vidéo...'}
                </span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e => handleFileSelect(e.target.files?.[0] || null)}
                />
              </label>
              {videoFile && (
                <button onClick={() => handleFileSelect(null)} className="p-1.5 rounded text-gray-400 hover:text-red-500">
                  <X size={14} />
                </button>
              )}
            </div>
            {videoFile && (
              <p className="text-[10px] text-gray-400">
                {(videoFile.size / (1024 * 1024)).toFixed(1)} Mo
              </p>
            )}
            <p className="text-[10px] text-gray-400 leading-relaxed">
              💡 Astuce : envoyez-vous la vidéo via WhatsApp avant de l'uploader, elle sera compressée. Max 150 Mo.
            </p>
          </div>

          <div>
            <Label>Lien (optionnel)</Label>
            <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div>
            <Label>Thématiques</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {DEFAULT_TOPICS[effectiveType].map(t => (
                <button
                  key={t}
                  onClick={() => topics.includes(t) ? setTopics(prev => prev.filter(x => x !== t)) : addTopic(t)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    topics.includes(t)
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-violet-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={topicInput}
                onChange={e => setTopicInput(e.target.value)}
                placeholder="Autre thématique..."
                onKeyDown={e => { if (e.key === 'Enter') { addTopic(topicInput); setTopicInput(''); } }}
              />
              <Button variant="outline" size="sm" onClick={() => { addTopic(topicInput); setTopicInput(''); }}>+</Button>
            </div>
            {topics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {topics.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                    {t}
                    <button onClick={() => setTopics(prev => prev.filter(x => x !== t))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Description (optionnel)</Label>
            <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Notes, niveau, contexte..." />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || saving || uploading}>
            {uploading ? 'Upload...' : saving ? 'Envoi...' : 'Ajouter'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Move Dialog ─────────────────────────────────────────

interface EditMoveDialogProps {
  move:    SalsaMoveItem | null;
  onClose: () => void;
  onSaved: (updated: SalsaMoveItem) => void;
  videos?: SalsaVideo[];
  onVideoUploaded: (moveId: string, video: SalsaVideo) => void;
  onDeleteVideo: (videoId: string) => void;
}

function EditMoveDialog({ move, onClose, onSaved, videos, onVideoUploaded, onDeleteVideo }: EditMoveDialogProps) {
  const { toast } = useToast();
  const [title,      setTitle]      = useState('');
  const [videoUrl,   setVideoUrl]   = useState('');
  const [linkUrl,    setLinkUrl]    = useState('');
  const [desc,       setDesc]       = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [topics,     setTopics]     = useState<string[]>([]);
  const [saving,     setSaving]     = useState(false);
  // Video file upload
  const [videoFile,  setVideoFile]  = useState<File | null>(null);
  const [uploading,  setUploading]  = useState(false);
  // User-selectable type (figures/solo)
  const [moveType, setMoveType]    = useState<SalsaType>('figures');
  const canChooseType = move ? (move.type === 'figures' || move.type === 'solo') : false;

  // Populate fields when move changes — reset ALL state to prevent stale flags
  useEffect(() => {
    if (move) {
      setTitle(move.title);
      setVideoUrl(move.videoUrl || '');
      setLinkUrl(move.linkUrl || '');
      setDesc(move.description || '');
      setTopics(move.topics || []);
      setVideoFile(null);
      setMoveType(move.type);
      setSaving(false);
      setUploading(false);
    }
  }, [move]);

  function addTopic(t: string) {
    const trimmed = t.trim();
    if (trimmed && !topics.includes(trimmed)) setTopics(prev => [...prev, trimmed]);
  }

  function handleFileSelect(f: File | null) {
    if (f) {
      if (f.size > 150 * 1024 * 1024) {
        toast({ title: 'Fichier trop volumineux', description: 'Maximum 150 Mo', variant: 'destructive' });
        return;
      }
      setVideoFile(f);
    } else {
      setVideoFile(null);
    }
  }

  async function handleSave() {
    if (!move || !title.trim()) return;
    setSaving(true);
    try {
      const updated = await updateMove(move.id, {
        type:        moveType,
        title:       title.trim(),
        videoUrl:    videoUrl.trim()  || undefined,
        linkUrl:     linkUrl.trim()   || undefined,
        description: desc.trim()      || undefined,
        topics,
      });

      // Upload video file if selected (transcode .mov etc. for browser compat)
      if (videoFile) {
        setUploading(true);
        try {
          let fileToUpload: File = videoFile;
          const { needsCompression, compressVideo } = await import('@/lib/videoCompress');
          if (needsCompression(videoFile)) {
            fileToUpload = await compressVideo(videoFile);
          }
          const vid = await uploadVideo(move.id, fileToUpload);
          onVideoUploaded(move.id, vid);
        } catch (e: any) {
          toast({ title: 'Erreur upload', description: e.message, variant: 'destructive' });
        }
        setUploading(false);
      }

      toast({ title: 'Modifié ✓' });
      onSaved(updated);
      onClose();
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de modifier.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const defaultTopics = DEFAULT_TOPICS[moveType] || [];

  return (
    <Dialog open={!!move} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {canChooseType && (
            <div>
              <Label>Type</Label>
              <div className="flex gap-1 mt-1">
                {(['figures', 'solo'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMoveType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      moveType === t ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label>Titre *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nom du mouvement" />
          </div>
          <div>
            <Label>URL vidéo (YouTube)</Label>
            <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="youtube.com/watch?v=..." />
          </div>

          {/* Video file upload */}
          <div className="space-y-2">
            <Label>Uploader une vidéo</Label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 hover:border-violet-400 cursor-pointer transition-colors flex-1">
                <Upload size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500 truncate">
                  {videoFile ? videoFile.name : 'Choisir une vidéo...'}
                </span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e => handleFileSelect(e.target.files?.[0] || null)}
                />
              </label>
              {videoFile && (
                <button onClick={() => handleFileSelect(null)} className="p-1.5 rounded text-gray-400 hover:text-red-500">
                  <X size={14} />
                </button>
              )}
            </div>
            {videoFile && (
              <p className="text-[10px] text-gray-400">
                {(videoFile.size / (1024 * 1024)).toFixed(1)} Mo
              </p>
            )}
            <p className="text-[10px] text-gray-400 leading-relaxed">
              💡 Astuce : envoyez-vous la vidéo via WhatsApp avant, elle sera compressée. Max 150 Mo.
            </p>
            {/* Existing videos */}
            {move && videos && videos.length > 0 && (
              <div className="pt-1">
                <p className="text-[10px] text-gray-400 mb-1">Vidéos existantes :</p>
                {videos.map(v => (
                  <div key={v.id} className="flex items-center gap-2 text-xs text-gray-500">
                    <Video size={11} />
                    <span className="truncate flex-1">{v.originalName}</span>
                    <span className="text-[10px]">{(v.fileSize / (1024 * 1024)).toFixed(1)} Mo</span>
                    <button
                      onClick={() => onDeleteVideo(v.id)}
                      className="p-0.5 rounded text-gray-400 hover:text-red-500 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Lien (optionnel)</Label>
            <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div>
            <Label>Thématiques</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {defaultTopics.map(t => (
                <button
                  key={t}
                  onClick={() => topics.includes(t) ? setTopics(prev => prev.filter(x => x !== t)) : addTopic(t)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    topics.includes(t)
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-violet-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={topicInput}
                onChange={e => setTopicInput(e.target.value)}
                placeholder="Autre thématique..."
                onKeyDown={e => { if (e.key === 'Enter') { addTopic(topicInput); setTopicInput(''); } }}
              />
              <Button variant="outline" size="sm" onClick={() => { addTopic(topicInput); setTopicInput(''); }}>+</Button>
            </div>
            {topics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {topics.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                    {t}
                    <button onClick={() => setTopics(prev => prev.filter(x => x !== t))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Description (optionnel)</Label>
            <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Notes, niveau, contexte..." />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving || uploading}>
            {uploading ? 'Upload...' : saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add to Playlist Dialog ───────────────────────────────────

interface AddToPlaylistDialogProps {
  moveId:     string | null;
  playlists:  Playlist[];
  onClose:    () => void;
  onToggle:   (playlistId: string, moveId: string, add: boolean) => Promise<void>;
  onCreate:   (name: string) => Promise<void>;
}

function AddToPlaylistDialog({ moveId, playlists, onClose, onToggle, onCreate }: AddToPlaylistDialogProps) {
  const [newName,   setNewName]   = useState('');
  const [creating,  setCreating]  = useState(false);
  const [saving,    setSaving]    = useState<string | null>(null);

  const myPlaylists = playlists.filter(pl => !pl.isShared);

  async function handleToggle(pl: Playlist) {
    if (!moveId) return;
    const inList = pl.items.some(i => i.moveId === moveId);
    setSaving(pl.id);
    try { await onToggle(pl.id, moveId, !inList); }
    finally { setSaving(null); }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try { await onCreate(newName.trim()); setNewName(''); }
    finally { setCreating(false); }
  }

  return (
    <Dialog open={!!moveId} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">🔖 Ajouter aux playlists</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {myPlaylists.length === 0 && (
            <p className="text-sm text-gray-400 italic">Aucune playlist. Crée-en une ci-dessous.</p>
          )}
          {myPlaylists.map(pl => {
            const inList = pl.items.some(i => i.moveId === moveId);
            return (
              <button
                key={pl.id}
                onClick={() => handleToggle(pl)}
                disabled={saving === pl.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm transition-colors text-left ${
                  inList
                    ? 'bg-violet-50 border-violet-300 text-violet-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-violet-300'
                }`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  inList ? 'bg-violet-600 border-violet-600' : 'border-gray-400'
                }`}>
                  {inList && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="flex-1 truncate">{pl.name}</span>
                <span className="text-xs text-gray-400">{pl.items.length}</span>
              </button>
            );
          })}
        </div>

        {/* Create new playlist */}
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nouvelle playlist..."
            className="h-8 text-xs"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <Button size="sm" variant="outline" className="h-8 px-2 shrink-0"
            onClick={handleCreate} disabled={!newName.trim() || creating}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────

const VALID_TYPES: SalsaType[] = ['cours', 'figures', 'solo'];

export default function SalsaPublic() {
  const { type } = useParams<{ type: string }>();
  const { toast } = useToast();

  const salsaType = VALID_TYPES.includes(type as SalsaType) ? (type as SalsaType) : null;
  const isCombined = salsaType === 'figures' || salsaType === 'solo';
  const [subTab, setSubTab] = useState<'figures' | 'solo'>('figures');

  const [email,           setEmail]           = useState('');
  const [authEmail,       setAuthEmail]       = useState<string | null>(null);
  const [validating,      setValidating]      = useState(false);
  const [gateError,       setGateError]       = useState('');
  const [moves,           setMoves]           = useState<SalsaMoveItem[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [addOpen,         setAddOpen]         = useState(false);
  const [searchQ,         setSearchQ]         = useState('');
  const [allProgress,     setAllProgress]     = useState<Record<string, ClassProgressItem[]>>({ class_1: [], class_2: [] });
  const [classNames,      setClassNames]      = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('kojima-salsa-class-names') || '{}'); }
    catch { return {}; }
  });
  const [editMove,        setEditMove]        = useState<SalsaMoveItem | null>(null);
  const [playlists,       setPlaylists]       = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [bookmarkMoveId,  setBookmarkMoveId]  = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);

  // Video state
  const [moveVideos, setMoveVideos] = useState<Record<string, SalsaVideo[]>>({});
  const [lightbox, setLightbox] = useState<{ src: string; title: string; trimStart?: number | null; trimEnd?: number | null } | null>(null);

  // Topic filter state
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  // Check stored email on mount
  useEffect(() => {
    if (!salsaType) return;
    const checkType = isCombined ? 'figures' : salsaType;
    const stored = localStorage.getItem(storageKey(checkType));
    if (stored) {
      validateAccess(checkType, stored)
        .then(() => setAuthEmail(stored))
        .catch(() => {
          localStorage.removeItem(storageKey(checkType));
          setAuthEmail(null);
        });
    }
  }, [salsaType, isCombined]);

  // Load moves when authenticated
  useEffect(() => {
    if (!authEmail || !salsaType) return;
    setLoading(true);
    if (isCombined) {
      Promise.all([listMoves('figures'), listMoves('solo')])
        .then(([fig, sol]) => {
          const all = [...fig, ...sol];
          setMoves(all);
          loadAllVideos(all);
        })
        .finally(() => setLoading(false));
    } else {
      listMoves(salsaType)
        .then(m => { setMoves(m); loadAllVideos(m); })
        .finally(() => setLoading(false));
    }
  }, [authEmail, salsaType, isCombined]);

  // Load videos for all moves
  async function loadAllVideos(allMoves: SalsaMoveItem[]) {
    const videoMap: Record<string, SalsaVideo[]> = {};
    await Promise.all(
      allMoves.map(async m => {
        try {
          const vids = await listVideos(m.id);
          if (vids.length > 0) videoMap[m.id] = vids;
        } catch {}
      })
    );
    setMoveVideos(videoMap);
  }

  // Load class progress (cours)
  useEffect(() => {
    if (!authEmail || salsaType !== 'cours') return;
    Promise.all([listProgress('class_1'), listProgress('class_2')])
      .then(([p1, p2]) => setAllProgress({ class_1: p1, class_2: p2 }))
      .catch(() => {});
  }, [authEmail, salsaType]);

  // Load playlists (figures + solo for combined view)
  useEffect(() => {
    if (!authEmail || !salsaType || !isCombined) return;
    Promise.all([listPlaylists('figures', authEmail), listPlaylists('solo', authEmail)])
      .then(([fig, sol]) => setPlaylists([...fig, ...sol]))
      .catch(() => {});
  }, [authEmail, salsaType, isCombined]);

  const handleValidate = useCallback(async () => {
    if (!salsaType || !email.trim()) return;
    const checkType = isCombined ? 'figures' : salsaType;
    setValidating(true);
    setGateError('');
    try {
      await validateAccess(checkType, email.trim());
      localStorage.setItem(storageKey(checkType), email.trim());
      setAuthEmail(email.trim());
    } catch {
      setGateError('Email non autorisé. Contacte Kojima Solutions pour demander l\'accès.');
    } finally {
      setValidating(false);
    }
  }, [salsaType, email, isCombined]);

  const handleSignOut = () => {
    if (!salsaType) return;
    const checkType = isCombined ? 'figures' : salsaType;
    localStorage.removeItem(storageKey(checkType));
    setAuthEmail(null);
    setMoves([]);
    setEmail('');
    setPlaylists([]);
    setMoveVideos({});
  };

  async function handleCreatePlaylist(name: string) {
    if (!salsaType || !isCombined || !authEmail) return;
    try {
      const pl = await createPlaylist({ type: subTab, email: authEmail, name });
      setPlaylists(prev => [...prev, pl]);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de créer la playlist.', variant: 'destructive' });
    }
  }

  async function handleDeletePlaylist(id: string) {
    setDeletingId(id);
    try {
      await deletePlaylist(id);
      setPlaylists(prev => prev.filter(pl => pl.id !== id));
      if (activePlaylistId === id) setActivePlaylistId(null);
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTogglePlaylistItem(playlistId: string, moveId: string, add: boolean) {
    try {
      if (add) {
        const item = await addToPlaylist(playlistId, moveId);
        setPlaylists(prev => prev.map(pl =>
          pl.id === playlistId ? { ...pl, items: [...pl.items, item] } : pl
        ));
      } else {
        await removeFromPlaylist(playlistId, moveId);
        setPlaylists(prev => prev.map(pl =>
          pl.id === playlistId ? { ...pl, items: pl.items.filter(i => i.moveId !== moveId) } : pl
        ));
      }
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  }

  function handleVideoUploaded(moveId: string, video: SalsaVideo) {
    setMoveVideos(prev => ({
      ...prev,
      [moveId]: [...(prev[moveId] || []), video],
    }));
  }

  async function handleDeleteVideo(videoId: string) {
    try {
      await deleteVideo(videoId);
      setMoveVideos(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          updated[key] = updated[key].filter(v => v.id !== videoId);
          if (updated[key].length === 0) delete updated[key];
        }
        return updated;
      });
    } catch {}
  }

  async function handleDeleteMove(moveId: string) {
    try {
      await deleteMove(moveId);
      setMoves(prev => prev.filter(m => m.id !== moveId));
      // Also clean up video cache
      setMoveVideos(prev => {
        const updated = { ...prev };
        delete updated[moveId];
        return updated;
      });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de supprimer.', variant: 'destructive' });
    }
  }

  // Collect all topics from current moves for topic filter
  const allTopics = useMemo(() => {
    const topicSet = new Set<string>();
    const relevantMoves = isCombined ? moves.filter(m => m.type === subTab) : moves;
    for (const m of relevantMoves) {
      for (const t of m.topics) topicSet.add(t);
    }
    return Array.from(topicSet).sort();
  }, [moves, isCombined, subTab]);

  if (!salsaType) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Type de salsa invalide.</p>
      </div>
    );
  }

  // ── Email gate ───────────────────────────────────────────────
  if (!authEmail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center flex flex-col gap-6">
          <div>
            <div className="text-4xl mb-3">💃</div>
            <h1 className="text-xl font-bold text-gray-900">{isCombined ? COMBINED_LABEL : TYPE_LABELS[salsaType]}</h1>
            <p className="text-sm text-gray-500 mt-1">Partagé par Kojima Solutions</p>
          </div>
          <div className="flex flex-col gap-3 text-left">
            <Label>Ton email pour accéder</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ton@email.com"
              onKeyDown={e => e.key === 'Enter' && handleValidate()}
            />
            {gateError && <p className="text-sm text-red-600">{gateError}</p>}
            <Button onClick={handleValidate} disabled={!email.trim() || validating} className="w-full">
              {validating ? 'Vérification...' : 'Continuer'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated view ────────────────────────────────────────
  const canPlaylist = isCombined;

  const myPlaylistMoveIds = new Set(
    playlists.filter(pl => !pl.isShared).flatMap(pl => pl.items.map(i => i.moveId))
  );

  const activePlaylistMoveIds = activePlaylistId
    ? new Set(playlists.find(pl => pl.id === activePlaylistId)?.items.map(i => i.moveId) ?? [])
    : null;

  // Filter moves
  const filtered = moves.filter(m => {
    if (isCombined && m.type !== subTab) return false;
    if (activePlaylistMoveIds && !activePlaylistMoveIds.has(m.id)) return false;
    if (activeTopic && !m.topics.includes(activeTopic)) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return m.title.toLowerCase().includes(q) || m.topics.some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

  const myPlaylists  = playlists.filter(pl => !pl.isShared);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-bold text-gray-900">💃 {isCombined ? COMBINED_LABEL : TYPE_LABELS[salsaType]}</h1>
            <p className="text-xs text-gray-400">Partagé par Kojima Solutions</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:block">{authEmail}</span>
            <button onClick={handleSignOut} className="text-xs text-gray-400 hover:text-gray-600 underline">
              Déconnecter
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* ── COURS: Choreography editor ──────────────────────── */}
        {salsaType === 'cours' && !loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 text-sm">🎶 Choregraphie</h2>
            </div>
            <div className="p-4">
              <ChoreographyEditor />
            </div>
          </div>
        )}

        {/* ── COURS: Class tracker ──────────────────────────────── */}
        {salsaType === 'cours' && !loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 text-sm">📅 Suivi des classes</h2>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {(['class_1', 'class_2'] as const).map(key => (
                <ClassColumn
                  key={key}
                  classKey={key}
                  className={classNames[key] || (key === 'class_1' ? 'Classe 1' : 'Classe 2')}
                  coursMoves={moves}
                  progress={allProgress[key] || []}
                  onProgressChange={items => setAllProgress(prev => ({ ...prev, [key]: items }))}
                  onRename={name => {
                    setClassNames(prev => {
                      const updated = { ...prev, [key]: name };
                      localStorage.setItem('kojima-salsa-class-names', JSON.stringify(updated));
                      return updated;
                    });
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── COURS: Video section ──────────────────────────────── */}
        {salsaType === 'cours' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-gray-700 text-sm">🎬 Vidéos</h2>
              <div className="ml-auto flex items-center gap-2">
                <Input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Rechercher..."
                  className="max-w-xs"
                />
                <Select value={activeTopic ?? 'all'} onValueChange={v => setActiveTopic(v === 'all' ? null : v)}>
                  <SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder="Tous les topics" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les topics</SelectItem>
                    {allTopics.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Proposer
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center text-gray-400 py-12">Chargement...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-gray-400 py-12">Aucun mouvement trouvé.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filtered.map(m => (
                  <PublicMoveCard
                    key={m.id}
                    move={m}
                    videos={moveVideos[m.id]}
                    inAnyPlaylist={myPlaylistMoveIds.has(m.id)}
                    canPlaylist={false}
                    authEmail={authEmail}
                    onBookmark={setBookmarkMoveId}
                    onEdit={setEditMove}
                    onDelete={handleDeleteMove}
                    onOpenVideo={(src, title, ts, te) => setLightbox({ src, title, trimStart: ts, trimEnd: te })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── FIGURES / SOLO: Sub-tab switcher ─────────────────── */}
        {isCombined && (
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
            {(['figures', 'solo'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setSubTab(t); setSearchQ(''); setActivePlaylistId(null); setActiveTopic(null); }}
                className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
                  subTab === t ? 'bg-white shadow font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        )}

        {/* ── FIGURES / SOLO: Playlist pills ───────────────────── */}
        {canPlaylist && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setActivePlaylistId(null)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  !activePlaylistId
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-violet-400'
                }`}
              >
                Toutes <span className={!activePlaylistId ? 'opacity-70' : 'opacity-50'}>({moves.length})</span>
              </button>

              {myPlaylists.map(pl => (
                <div key={pl.id} className="flex items-center gap-0.5">
                  <button
                    onClick={() => setActivePlaylistId(activePlaylistId === pl.id ? null : pl.id)}
                    className={`text-xs px-2.5 py-1 rounded-l-full border-y border-l transition-colors ${
                      activePlaylistId === pl.id
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-violet-400'
                    }`}
                  >
                    {pl.name} <span className="opacity-50">({pl.items.length})</span>
                  </button>
                  <button
                    onClick={() => handleDeletePlaylist(pl.id)}
                    disabled={deletingId === pl.id}
                    className={`text-xs px-1.5 py-1 rounded-r-full border-y border-r transition-colors ${
                      activePlaylistId === pl.id
                        ? 'bg-violet-600 text-white border-violet-600 hover:bg-violet-700'
                        : 'bg-white text-gray-400 border-gray-300 hover:text-red-500 hover:border-red-300'
                    }`}
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}

              {creatingPlaylist ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={newPlaylistName}
                    onChange={e => setNewPlaylistName(e.target.value)}
                    placeholder="Nom..."
                    className="h-7 text-xs w-28 px-2"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newPlaylistName.trim()) {
                        handleCreatePlaylist(newPlaylistName.trim());
                        setNewPlaylistName('');
                        setCreatingPlaylist(false);
                      }
                      if (e.key === 'Escape') { setCreatingPlaylist(false); setNewPlaylistName(''); }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newPlaylistName.trim()) handleCreatePlaylist(newPlaylistName.trim());
                      setNewPlaylistName('');
                      setCreatingPlaylist(false);
                    }}
                    className="text-xs text-violet-600 hover:text-violet-800 px-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { setCreatingPlaylist(false); setNewPlaylistName(''); }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreatingPlaylist(true)}
                  className="text-xs px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-violet-400 hover:text-violet-600 transition-colors"
                >
                  + Playlist
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── FIGURES / SOLO: Toolbar + topic filters + grid ──── */}
        {isCombined && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Rechercher..."
                className="max-w-xs"
              />
              <Select value={activeTopic ?? 'all'} onValueChange={v => setActiveTopic(v === 'all' ? null : v)}>
                <SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder="Tous les topics" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les topics</SelectItem>
                  {allTopics.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setAddOpen(true)} className="ml-auto">
                <Plus className="w-4 h-4 mr-1" />
                Ajouter
              </Button>
            </div>

            {loading ? (
              <div className="text-center text-gray-400 py-12">Chargement...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                {activePlaylistId ? 'Cette playlist est vide.' : 'Aucun mouvement trouvé.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filtered.map(m => (
                  <PublicMoveCard
                    key={m.id}
                    move={m}
                    videos={moveVideos[m.id]}
                    inAnyPlaylist={myPlaylistMoveIds.has(m.id)}
                    canPlaylist={canPlaylist}
                    authEmail={authEmail}
                    onBookmark={setBookmarkMoveId}
                    onEdit={setEditMove}
                    onDelete={handleDeleteMove}
                    onOpenVideo={(src, title, ts, te) => setLightbox({ src, title, trimStart: ts, trimEnd: te })}
                  />
                ))}
              </div>
            )}
          </>
        )}

      </main>

      <AddMoveDialog
        type={isCombined ? subTab : salsaType}
        open={addOpen}
        authEmail={authEmail}
        onClose={() => setAddOpen(false)}
        onAdded={move => setMoves(prev => [...prev, move])}
        onVideoUploaded={handleVideoUploaded}
      />

      <EditMoveDialog
        move={editMove}
        onClose={() => setEditMove(null)}
        onSaved={updated => setMoves(prev => prev.map(m => m.id === updated.id ? updated : m))}
        videos={editMove ? moveVideos[editMove.id] : undefined}
        onVideoUploaded={handleVideoUploaded}
        onDeleteVideo={handleDeleteVideo}
      />

      {canPlaylist && (
        <AddToPlaylistDialog
          moveId={bookmarkMoveId}
          playlists={playlists}
          onClose={() => setBookmarkMoveId(null)}
          onToggle={handleTogglePlaylistItem}
          onCreate={async (name) => {
            await handleCreatePlaylist(name);
          }}
        />
      )}

      {/* Video lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            onClick={() => setLightbox(null)}
          >
            <X size={24} />
          </button>
          <div
            className="w-full max-w-4xl max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {lightbox.src.startsWith('youtube:') ? (
              <div className="aspect-video w-full">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${lightbox.src.replace('youtube:', '')}?autoplay=1`}
                  className="w-full h-full rounded-xl"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
            ) : (
              <VideoPlayer
                src={lightbox.src}
                title={lightbox.title}
                trimStart={lightbox.trimStart}
                trimEnd={lightbox.trimEnd}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
