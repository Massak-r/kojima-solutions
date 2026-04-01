import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Star, ExternalLink, Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { createOption, updateOption, deleteOption } from "@/api/funnels";
import type { GateOption } from "@/api/funnels";
import { uploadImage } from "@/api/projects";
import { useToast } from "@/hooks/use-toast";

interface GateOptionEditorProps {
  gateId: string;
  options: GateOption[];
  onUpdate: () => void;
}

// ── Single option row (controlled inputs) ──────────────────

function OptionRow({ opt, onFieldUpdate, onImagesUpdate, onDelete, isDeleting, setDeleting }: {
  opt: GateOption;
  onFieldUpdate: (id: string, field: Partial<GateOption>) => void;
  onImagesUpdate: (id: string, images: string[]) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  setDeleting: (id: string | null) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(opt.title);
  const [description, setDescription] = useState(opt.description);
  const [linkUrl, setLinkUrl] = useState(opt.linkUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync from parent when option data changes (e.g. after refetch)
  useEffect(() => { setTitle(opt.title); }, [opt.id, opt.title]);
  useEffect(() => { setDescription(opt.description); }, [opt.id, opt.description]);
  useEffect(() => { setLinkUrl(opt.linkUrl ?? ""); }, [opt.id, opt.linkUrl]);

  const images = opt.images ?? [];

  function commitTitle() {
    if (title !== opt.title) onFieldUpdate(opt.id, { title });
  }
  function commitDescription() {
    if (description !== opt.description) onFieldUpdate(opt.id, { description });
  }
  function commitLinkUrl() {
    const val = linkUrl || null;
    if (val !== (opt.linkUrl ?? null)) onFieldUpdate(opt.id, { linkUrl: val });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const newImages = [...images];
    try {
      for (const file of Array.from(files)) {
        const url = await uploadImage(file);
        newImages.push(url);
      }
      onImagesUpdate(opt.id, newImages);
    } catch {
      toast({ title: "Erreur d'upload", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(index: number) {
    const newImages = images.filter((_, i) => i !== index);
    onImagesUpdate(opt.id, newImages);
  }

  return (
    <div
      className={cn(
        "p-3 rounded-lg border bg-background/50 space-y-2",
        opt.isRecommended && "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur())}
          placeholder="Titre de l'option..."
          className="flex-1 text-sm font-body bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-0.5 transition-colors"
        />
        <button
          onClick={() => onFieldUpdate(opt.id, { isRecommended: !opt.isRecommended })}
          className={cn(
            "p-1 rounded transition-colors",
            opt.isRecommended ? "text-primary" : "text-muted-foreground/30 hover:text-primary/60",
          )}
          title={opt.isRecommended ? "Recommande" : "Marquer comme recommande"}
        >
          <Star size={14} fill={opt.isRecommended ? "currentColor" : "none"} />
        </button>
        {isDeleting ? (
          <div className="flex items-center gap-1">
            <button onClick={() => onDelete(opt.id)} className="text-[10px] text-destructive font-medium">Supprimer</button>
            <button onClick={() => setDeleting(null)} className="text-[10px] text-muted-foreground">Annuler</button>
          </div>
        ) : (
          <button onClick={() => setDeleting(opt.id)} className="p-1 text-muted-foreground/30 hover:text-destructive transition-colors">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={commitDescription}
        placeholder="Description..."
        rows={2}
        className="w-full text-xs font-body bg-secondary/20 border border-border/30 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none placeholder:text-muted-foreground/30"
      />

      {/* Image gallery strip */}
      <div className="space-y-1.5">
        {images.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {images.map((url, i) => (
              <div key={i} className="relative group w-20 h-14 rounded-md overflow-hidden border border-border/30">
                <img src={url} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={8} />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-0.5 left-0.5 text-[7px] bg-primary/80 text-white px-1 rounded font-mono">
                    cover
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-[11px] font-body text-muted-foreground/50 hover:text-primary border border-dashed border-border/40 hover:border-primary/40 rounded-md px-2 py-1 transition-colors"
          >
            {uploading ? (
              <><Loader2 size={10} className="animate-spin" /> Upload en cours...</>
            ) : (
              <><ImageIcon size={10} /> {images.length > 0 ? "Ajouter des images" : "Ajouter des images"}</>
            )}
          </button>

          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onBlur={commitLinkUrl}
            placeholder="URL apercu..."
            className="flex-1 text-[11px] font-body bg-secondary/20 border border-border/30 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/30"
          />
        </div>
      </div>

      {opt.linkUrl && (
        <a href={opt.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
          <ExternalLink size={10} /> Voir l'apercu
        </a>
      )}
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────

export function GateOptionEditor({ gateId, options, onUpdate }: GateOptionEditorProps) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    if (!newTitle.trim()) return;
    try {
      await createOption({ gateId, title: newTitle.trim(), optionOrder: options.length });
      setNewTitle("");
      setAdding(false);
      onUpdate();
    } catch {
      toast({ title: "Erreur", description: "Impossible d'ajouter l'option", variant: "destructive" });
    }
  }

  async function handleFieldUpdate(id: string, field: Partial<GateOption>) {
    try {
      await updateOption(id, field);
      onUpdate();
    } catch {}
  }

  async function handleImagesUpdate(id: string, images: string[]) {
    try {
      await updateOption(id, {
        imageUrl: images[0] || null, // first image = cover
        imagesJson: images,
      });
      onUpdate();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteOption(id);
      setDeletingId(null);
      onUpdate();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-display font-semibold text-muted-foreground/70 uppercase tracking-wider">
        Options ({options.length})
      </h4>

      {options.map((opt) => (
        <OptionRow
          key={opt.id}
          opt={opt}
          onFieldUpdate={handleFieldUpdate}
          onImagesUpdate={handleImagesUpdate}
          onDelete={handleDelete}
          isDeleting={deletingId === opt.id}
          setDeleting={setDeletingId}
        />
      ))}

      {adding ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Titre de l'option..."
            className="flex-1 text-sm font-body bg-secondary/30 border border-border/30 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/30"
            autoFocus
          />
          <button onClick={handleAdd} className="text-xs text-primary font-medium">Ajouter</button>
          <button onClick={() => { setAdding(false); setNewTitle(""); }} className="text-xs text-muted-foreground">Annuler</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-primary transition-colors py-1"
        >
          <Plus size={12} /> Ajouter une option
        </button>
      )}
    </div>
  );
}
