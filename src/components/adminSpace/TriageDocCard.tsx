import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  FileText, Eye, Trash2, Zap, FolderInput, Check, X, Pencil, Sparkles, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useClients } from "@/contexts/ClientsContext";
import { classifyPdf, updateDoc, type AdminDocItem, type DocFolder } from "@/api/adminDocs";
import { classifyDocument, type ClassifySuggestion, type DocCategory } from "@/lib/docClassifier";
import { folderOptions, formatBytes, formatDate } from "./helpers";
import { DocPreviewSheet } from "./DocPreviewSheet";

const CATEGORIES: DocCategory[] = ["Comptabilité", "Contrats", "Administratif", "Technique", "RH", "Clients", "Autre"];

interface TriageDocCardProps {
  doc: AdminDocItem;
  folders: DocFolder[];
  viewUrl: string;
  /** True while a mutation for this specific card is in flight. */
  busy: boolean;
  onFile: (folderId: string) => void;
  onToggleUrgent: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  /** Refresh the parent list after the panel applies its own mutations. */
  onChanged?: () => void;
}

/** A single pending (to-sort) document in the triage queue. */
export function TriageDocCard({
  doc, folders, viewUrl, busy, onFile, onToggleUrgent, onRename, onDelete, onChanged,
}: TriageDocCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(doc.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [classifyState, setClassifyState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; suggestion: ClassifySuggestion; editing: ClassifySuggestion }
    | { kind: "applying" }
  >({ kind: "idle" });
  const { clients } = useClients();
  const opts = folderOptions(folders);

  function saveTitle() {
    const trimmed = title.trim();
    if (trimmed && trimmed !== doc.title) onRename(trimmed);
    setEditing(false);
  }
  function cancelEdit() {
    setTitle(doc.title);
    setEditing(false);
  }

  async function runAutoClassify() {
    setClassifyState({ kind: "loading" });
    try {
      const payload = await classifyPdf(doc.id);
      const suggestion = classifyDocument({
        filename: payload.filename || doc.originalName || doc.title,
        text: payload.extractedText,
        currentTitle: doc.title,
        folders,
        clients,
      });
      setClassifyState({ kind: "ready", suggestion, editing: suggestion });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "";
      if (!message.includes("→ 401")) {
        toast.error("Auto-classement impossible — vérifie ta connexion.");
      }
      setClassifyState({ kind: "idle" });
    }
  }

  async function applySuggestion() {
    if (classifyState.kind !== "ready") return;
    const { editing } = classifyState;
    setClassifyState({ kind: "applying" });
    try {
      // Single PATCH so the UI sees one commit, not three. Filing into a folder
      // also flips status from to_sort → filed; without a folder we just
      // rename + retag and leave the doc in triage for manual filing later.
      await updateDoc(doc.id, {
        title:    editing.title,
        category: editing.category,
        year:     editing.year,
        tags:     editing.tags,
        ...(editing.folderId
          ? { folderId: editing.folderId, status: "filed", urgent: false }
          : {}),
      });
      if (editing.folderId) {
        const folderName = folders.find((f) => f.id === editing.folderId)?.name ?? "le dossier";
        toast.success(`Classé dans « ${folderName} »`);
      } else {
        toast.success("Métadonnées mises à jour");
      }
      onChanged?.();
      setClassifyState({ kind: "idle" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Échec de l'application";
      if (!message.includes("→ 401")) {
        toast.error("Échec de l'application");
      }
      setClassifyState({ kind: "ready", suggestion: classifyState.suggestion, editing: classifyState.editing });
    }
  }

  return (
    <div className={cn(
      "glass-card rounded-2xl p-4 flex flex-col gap-3 transition-colors",
      doc.urgent && "border-red-300 bg-red-50/50",
    )}>
      {/* Title block — full width so it can breathe on narrow screens. */}
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          doc.urgent ? "bg-red-100" : "bg-destructive/10",
        )}>
          <FileText size={18} className={doc.urgent ? "text-red-500" : "text-destructive/70"} />
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex gap-1.5 items-center">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8 text-sm font-body"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") cancelEdit();
                }}
                autoFocus
              />
              <button onClick={saveTitle} className="text-primary hover:text-primary/80 shrink-0 p-1">
                <Check size={17} />
              </button>
              <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground shrink-0 p-1">
                <X size={17} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="font-body font-medium text-sm break-words">{doc.title}</p>
              <button
                onClick={() => { setTitle(doc.title); setEditing(true); }}
                className="text-muted-foreground/40 hover:text-foreground shrink-0 p-1"
                title="Renommer"
                aria-label="Renommer"
              >
                <Pencil size={13} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground font-body">
            {doc.urgent && (
              <Badge className="bg-red-500 hover:bg-red-500 text-white gap-1 text-[10px]">
                <Zap size={9} /> Urgent
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">{doc.category}</Badge>
            <span>{formatBytes(doc.fileSize)}</span>
            <span>·</span>
            <span>{formatDate(doc.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* File-it row — picking a folder archives the document. */}
      <div className="flex items-center gap-2 border-t border-border/60 pt-3">
        <FolderInput size={16} className="text-primary shrink-0" />
        <Select
          disabled={busy || opts.length === 0}
          onValueChange={(v) => onFile(v)}
        >
          <SelectTrigger className="h-9 text-xs font-body flex-1">
            <SelectValue placeholder={
              opts.length === 0
                ? "Aucun dossier — créez-en dans l'onglet Documents"
                : "Classer dans un dossier…"
            } />
          </SelectTrigger>
          <SelectContent>
            {opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Auto-classify suggestion panel */}
      {classifyState.kind === "ready" || classifyState.kind === "applying" ? (
        <div className="rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50/60 dark:bg-violet-500/10 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-body font-semibold text-violet-700 dark:text-violet-300">
              <Sparkles size={12} />
              Suggestion ·{" "}
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px]",
                classifyState.suggestion.confidence === "high"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : classifyState.suggestion.confidence === "medium"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                  : "bg-muted text-muted-foreground",
              )}>
                {classifyState.suggestion.confidence === "high" ? "Confiance élevée"
                 : classifyState.suggestion.confidence === "medium" ? "Confiance moyenne"
                 : "Faible confiance"}
              </span>
            </div>
            <button
              onClick={() => setClassifyState({ kind: "idle" })}
              className="text-muted-foreground hover:text-foreground p-1"
              aria-label="Fermer la suggestion"
            >
              <X size={13} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Titre</label>
              <Input
                value={classifyState.editing.title}
                onChange={(e) => setClassifyState((s) =>
                  s.kind === "ready"
                    ? { ...s, editing: { ...s.editing, title: e.target.value } }
                    : s,
                )}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Catégorie</label>
              <Select
                value={classifyState.editing.category}
                onValueChange={(v) => setClassifyState((s) =>
                  s.kind === "ready"
                    ? { ...s, editing: { ...s.editing, category: v as DocCategory } }
                    : s,
                )}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Année</label>
              <Input
                type="number"
                inputMode="numeric"
                min={2000}
                max={2100}
                placeholder="ex : 2026"
                value={classifyState.editing.year ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  const n = v === "" ? null : Number.parseInt(v, 10);
                  setClassifyState((s) =>
                    s.kind === "ready"
                      ? { ...s, editing: { ...s.editing, year: Number.isFinite(n as number) ? (n as number) : null } }
                      : s,
                  );
                }}
                className="h-8 text-sm tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Dossier cible</label>
              <Select
                value={classifyState.editing.folderId ?? "__none__"}
                onValueChange={(v) => setClassifyState((s) =>
                  s.kind === "ready"
                    ? { ...s, editing: { ...s.editing, folderId: v === "__none__" ? null : v } }
                    : s,
                )}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Laisser dans la boîte de tri" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Laisser à trier (rien faire)</SelectItem>
                  {opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Tags</label>
              <TagsEditor
                value={classifyState.editing.tags}
                onChange={(next) => setClassifyState((s) =>
                  s.kind === "ready"
                    ? { ...s, editing: { ...s.editing, tags: next } }
                    : s,
                )}
              />
            </div>
          </div>

          {classifyState.suggestion.clientId && (
            <p className="text-[11px] font-body text-muted-foreground">
              Client détecté :{" "}
              <span className="text-foreground font-medium">
                {clients.find((c) => c.id === classifyState.suggestion.clientId)?.name ?? "—"}
              </span>
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs font-body"
              onClick={() => setClassifyState({ kind: "idle" })}
              disabled={classifyState.kind === "applying"}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs font-body"
              onClick={applySuggestion}
              disabled={classifyState.kind === "applying"}
            >
              {classifyState.kind === "applying"
                ? <Loader2 size={12} className="animate-spin mr-1.5" />
                : <Check size={12} className="mr-1.5" />}
              Appliquer
            </Button>
          </div>
        </div>
      ) : null}

      {/* Action row — bigger tap targets, always visible on every breakpoint. */}
      <div className="flex items-center justify-between gap-2 -mb-1">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={runAutoClassify}
            disabled={busy || classifyState.kind === "loading" || classifyState.kind === "applying"}
            className={cn(
              "px-3 py-2 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 text-xs font-body font-medium",
              classifyState.kind === "ready"
                ? "text-primary bg-primary/10 hover:bg-primary/20"
                : "text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/15",
            )}
            title="Suggérer titre + catégorie + dossier à partir du contenu"
            aria-label="Auto-classer"
          >
            {classifyState.kind === "loading"
              ? <Loader2 size={14} className="animate-spin" />
              : <Sparkles size={14} />}
            <span className="hidden sm:inline">
              {classifyState.kind === "ready" ? "Revoir suggestion" : "Auto-classer"}
            </span>
          </button>
          <button
            onClick={onToggleUrgent}
            disabled={busy}
            className={cn(
              "px-3 py-2 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 text-xs font-body font-medium",
              doc.urgent
                ? "text-red-600 bg-red-100 hover:bg-red-200"
                : "text-muted-foreground hover:text-red-500 hover:bg-red-50",
            )}
            title={doc.urgent ? "Retirer l'urgence" : "Marquer comme urgent"}
            aria-pressed={doc.urgent}
          >
            <Zap size={14} />
            <span className="hidden sm:inline">{doc.urgent ? "Urgent" : "Urgent ?"}</span>
          </button>
          <button
            onClick={() => setPreviewOpen(true)}
            className="px-3 py-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors inline-flex items-center gap-1.5 text-xs font-body font-medium"
            title="Aperçu du PDF"
            aria-label="Aperçu du PDF"
          >
            <Eye size={14} />
            <span className="hidden sm:inline">Aperçu</span>
          </button>
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="destructive"
              className="h-9 text-xs"
              onClick={onDelete}
              disabled={busy}
            >
              Supprimer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 text-xs"
              onClick={() => setConfirmDelete(false)}
            >
              Annuler
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors inline-flex items-center gap-1.5 text-xs font-body font-medium"
            title="Supprimer"
            aria-label="Supprimer"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Supprimer</span>
          </button>
        )}
      </div>

      <DocPreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={doc.title}
        viewUrl={viewUrl}
      />
    </div>
  );
}

/** Small editable chip list. Enter / comma commits the typed tag; backspace
 *  on an empty input removes the last chip. Max 8 tags, 40 chars each — the
 *  backend trims/dedupes again so this is just for UX. */
function TagsEditor({
  value, onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function commit(raw: string) {
    const v = raw.trim().replace(/^,+|,+$/g, "").trim();
    if (!v) return;
    if (value.length >= 8) return;
    const lower = v.toLowerCase();
    if (value.some((t) => t.toLowerCase() === lower)) return;
    onChange([...value, v.slice(0, 40)]);
    setInput("");
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 min-h-[34px]">
      {value.map((t, i) => (
        <span
          key={`${t}-${i}`}
          className="inline-flex items-center gap-1 text-[11px] font-body rounded-full bg-secondary text-secondary-foreground px-2 py-0.5"
        >
          {t}
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="text-muted-foreground hover:text-destructive transition-colors"
            aria-label={`Retirer ${t}`}
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(",")) commit(v);
          else setInput(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(input);
          } else if (e.key === "Backspace" && input === "" && value.length > 0) {
            e.preventDefault();
            removeAt(value.length - 1);
          }
        }}
        onBlur={() => { if (input.trim()) commit(input); }}
        placeholder={value.length === 0 ? "Ajouter un tag, Entrée pour valider" : ""}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-xs font-body"
      />
    </div>
  );
}
