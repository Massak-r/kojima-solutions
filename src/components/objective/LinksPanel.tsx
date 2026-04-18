import { useEffect, useState } from "react";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listLinks, createLink, updateLink, deleteLink, type ObjectiveLink } from "@/api/objectiveLinks";
import type { ObjectiveSource } from "@/api/objectiveSource";

interface LinksPanelProps {
  source: ObjectiveSource;
  objectiveId: string;
}

function guessTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LinksPanel({ source, objectiveId }: LinksPanelProps) {
  const [links, setLinks]     = useState<ObjectiveLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [draftUrl,   setDraftUrl]   = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDesc,  setDraftDesc]  = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listLinks(source, objectiveId)
      .then(setLinks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [source, objectiveId]);

  async function handleAdd() {
    const url = draftUrl.trim();
    if (!url) return;
    const title = draftTitle.trim() || guessTitleFromUrl(url);
    const desc  = draftDesc.trim();
    const temp: ObjectiveLink = {
      id: crypto.randomUUID(),
      source, objectiveId,
      url, title,
      description: desc || null,
      faviconUrl: null,
      order: links.length,
      createdAt: new Date().toISOString(),
    };
    setLinks(prev => [...prev, temp]);
    setAdding(false);
    setDraftUrl(""); setDraftTitle(""); setDraftDesc("");
    try {
      const real = await createLink({ source, objectiveId, url, title, description: desc || undefined });
      setLinks(prev => prev.map(l => l.id === temp.id ? real : l));
    } catch {}
  }

  async function handleDelete(id: string) {
    setLinks(prev => prev.filter(l => l.id !== id));
    setConfirmDelete(null);
    try { await deleteLink(id); } catch {}
  }

  function handlePatch(id: string, patch: Partial<ObjectiveLink>) {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    updateLink(id, patch as any).catch(() => {});
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-display font-bold text-foreground/60 uppercase tracking-wider">
          {links.length === 0 ? "Aucun lien" : `${links.length} lien${links.length > 1 ? "s" : ""}`}
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="h-8 rounded-full">
            <Plus size={14} className="mr-1" /> Ajouter un lien
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl border border-border/40 bg-card/40 p-4 space-y-2">
          <input
            type="url"
            placeholder="https://exemple.com"
            value={draftUrl}
            onChange={e => setDraftUrl(e.target.value)}
            autoFocus
            className="w-full text-sm font-body bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
          <input
            type="text"
            placeholder="Titre (facultatif)"
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            className="w-full text-sm font-body bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
          <textarea
            placeholder="Description / pourquoi ce lien ? (facultatif)"
            value={draftDesc}
            onChange={e => setDraftDesc(e.target.value)}
            rows={2}
            className="w-full text-sm font-body bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!draftUrl.trim()} className="h-8 rounded-lg">Ajouter</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setDraftUrl(""); setDraftTitle(""); setDraftDesc(""); }} className="h-8 rounded-lg">Annuler</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : links.length === 0 && !adding ? (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded-2xl border border-dashed border-border/40 hover:border-border/70 hover:bg-card/40 p-6 sm:p-8 text-center transition-all"
        >
          <div className="text-sm font-body text-muted-foreground">
            Aucun lien pour cet objectif.
          </div>
          <div className="text-xs font-body text-muted-foreground/50 mt-1">
            Références, inspirations, docs externes…
          </div>
        </button>
      ) : (
        <div className="space-y-2">
          {links.map(link => (
            <LinkRow
              key={link.id}
              link={link}
              onPatch={patch => handlePatch(link.id, patch)}
              onDelete={() => setConfirmDelete(link.id)}
              confirming={confirmDelete === link.id}
              onCancelDelete={() => setConfirmDelete(null)}
              onConfirmDelete={() => handleDelete(link.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LinkRow({ link, onPatch, onDelete, confirming, onCancelDelete, onConfirmDelete }: {
  link: ObjectiveLink;
  onPatch: (patch: Partial<ObjectiveLink>) => void;
  onDelete: () => void;
  confirming: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title,   setTitle]   = useState(link.title);
  const [desc,    setDesc]    = useState(link.description ?? "");

  function save() {
    if (title !== link.title || (desc || null) !== (link.description || null)) {
      onPatch({ title, description: desc || null });
    }
    setEditing(false);
  }

  return (
    <div className={cn(
      "rounded-xl border bg-card/40 p-3 flex items-start gap-3 transition-all",
      "border-border/40 hover:border-border/60",
    )}>
      {link.faviconUrl ? (
        <img src={link.faviconUrl} alt="" width={20} height={20} className="shrink-0 rounded mt-0.5" />
      ) : (
        <ExternalLink size={16} className="text-muted-foreground/60 shrink-0 mt-1" />
      )}

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              className="w-full text-sm font-body font-semibold bg-secondary/50 border border-border/50 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              placeholder="Description"
              className="w-full text-xs font-body bg-secondary/50 border border-border/50 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={save} className="text-xs font-body font-semibold text-primary hover:underline">OK</button>
              <button onClick={() => { setEditing(false); setTitle(link.title); setDesc(link.description ?? ""); }} className="text-xs font-body text-muted-foreground hover:underline">Annuler</button>
            </div>
          </div>
        ) : (
          <>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-body font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              <span className="break-words">{link.title || link.url}</span>
              <ExternalLink size={11} className="opacity-50" />
            </a>
            <div className="text-[11px] font-mono text-muted-foreground/70 truncate">{link.url}</div>
            {link.description && (
              <div className="text-xs font-body text-foreground/60 mt-1 leading-relaxed">{link.description}</div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!editing && !confirming && (
          <>
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] font-body text-muted-foreground/60 hover:text-foreground px-1.5 py-0.5 rounded transition-colors"
            >
              Modifier
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded text-muted-foreground/40 hover:text-destructive transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
        {confirming && (
          <div className="flex gap-1">
            <Button size="sm" variant="destructive" className="h-7 px-2 text-[11px] rounded-md" onClick={onConfirmDelete}>Oui</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] rounded-md" onClick={onCancelDelete}>Non</Button>
          </div>
        )}
      </div>
    </div>
  );
}
