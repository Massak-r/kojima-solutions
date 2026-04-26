import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Plus, Trash2, ExternalLink, Link2, Link2Off, Folder, GripVertical, Pencil,
} from "lucide-react";
import type { DocFolder, DocFolderLink } from "@/api/adminDocs";
import { RichText } from "./RichText";

interface FolderCardProps {
  folder: DocFolder;
  isEditing: boolean;
  isDeleting: boolean;
  handleProps: Record<string, unknown>;
  onSelect: (id: string) => void;
  onShare: (f: DocFolder) => void;
  onUnshare: (f: DocFolder) => void;
  onStartEdit: () => void;
  onSaveEdit: (patch: { name: string; summary: string | null; links: DocFolderLink[] }) => void;
  onCancelEdit: () => void;
  onStartDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

export function FolderCard({
  folder, isEditing, isDeleting, handleProps,
  onSelect, onShare, onUnshare,
  onStartEdit, onSaveEdit, onCancelEdit,
  onStartDelete, onConfirmDelete, onCancelDelete,
}: FolderCardProps) {
  const [name, setName] = useState(folder.name);
  const [summary, setSummary] = useState(folder.summary ?? "");
  const [links, setLinks] = useState<DocFolderLink[]>(folder.links?.length ? [...folder.links] : []);

  useEffect(() => {
    if (isEditing) {
      setName(folder.name);
      setSummary(folder.summary ?? "");
      setLinks(folder.links?.length ? [...folder.links] : []);
    }
  }, [isEditing, folder]);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSaveEdit({
      name: trimmed,
      summary: summary.trim() || null,
      links: links.filter(l => l.url.trim()),
    });
  }

  return (
    <div className="glass-card rounded-xl p-4 group cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all">
      {isEditing ? (
        <div className="space-y-2" onClick={e => e.stopPropagation()}>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nom du dossier"
            className="h-8 text-sm font-body"
            autoFocus
          />
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            placeholder="Résumé (optionnel)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-body resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            rows={2}
          />
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-body">Liens externes</p>
            {links.map((link, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <Input
                  value={link.label}
                  onChange={e => setLinks(prev => prev.map((l, j) => j === i ? { ...l, label: e.target.value } : l))}
                  placeholder="Libellé"
                  className="h-7 text-xs font-body flex-1"
                />
                <Input
                  value={link.url}
                  onChange={e => setLinks(prev => prev.map((l, j) => j === i ? { ...l, url: e.target.value } : l))}
                  placeholder="https://..."
                  className="h-7 text-xs font-body flex-[2]"
                />
                <button onClick={() => setLinks(prev => prev.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setLinks(prev => [...prev, { label: "", url: "" }])}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-body"
            >
              <Plus size={11} /> Ajouter un lien
            </button>
          </div>
          <div className="flex gap-1.5 pt-1">
            <Button size="sm" className="h-7 text-xs px-3" onClick={save}>Enregistrer</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs px-3" onClick={onCancelEdit}>Annuler</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <button {...handleProps} className="p-0.5 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" onClick={e => e.stopPropagation()}>
              <GripVertical size={14} />
            </button>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 relative" onClick={() => onSelect(folder.id)}>
              <Folder size={20} className="text-primary" />
              {folder.shareToken && <Link2 size={7} className="absolute -top-0.5 -right-0.5 text-primary" />}
            </div>
            <span className="font-body text-sm font-medium flex-1 break-words" onClick={() => onSelect(folder.id)}>{folder.name}</span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {folder.shareToken ? (
                <button onClick={e => { e.stopPropagation(); onUnshare(folder); }} className="p-1 text-primary hover:text-destructive" title="Supprimer le partage"><Link2Off size={11} /></button>
              ) : (
                <button onClick={e => { e.stopPropagation(); onShare(folder); }} className="p-1 text-muted-foreground hover:text-primary" title="Partager le dossier"><Link2 size={11} /></button>
              )}
              <button onClick={e => { e.stopPropagation(); onStartEdit(); }} className="p-1 text-muted-foreground hover:text-foreground"><Pencil size={11} /></button>
              {isDeleting ? (
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={onConfirmDelete}>OK</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={onCancelDelete}>Non</Button>
                </div>
              ) : (
                <button onClick={e => { e.stopPropagation(); onStartDelete(); }} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={11} /></button>
              )}
            </div>
          </div>
          {folder.summary && (
            <div className="text-xs text-muted-foreground font-body mt-2 ml-[3.25rem]">
              <RichText text={folder.summary} />
            </div>
          )}
          {folder.links && folder.links.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5 ml-[3.25rem]">
              {folder.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/8 text-primary hover:bg-primary/15 transition-colors font-body"
                >
                  <ExternalLink size={9} /> {link.label || link.url}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
