import { useState } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { uploadImage } from "@/api/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Package, Link2, Image as ImageIcon, FileText, Type, Plus, Trash2, Upload, X, ExternalLink, Loader2,
} from "lucide-react";
import type { TimelineTask } from "@/types/timeline";
import type { Delivery } from "@/types/project";

const TYPE_META: Record<Delivery["type"], { label: string; icon: typeof Link2 }> = {
  link:  { label: "Lien", icon: Link2 },
  image: { label: "Image(s)", icon: ImageIcon },
  file:  { label: "Fichier", icon: FileText },
  text:  { label: "Note", icon: Type },
};

/**
 * Admin UI to manage a project's deliverables (links / images / files / notes),
 * attached to a step or marked final. They render in the client's project space
 * (ClientDashboard). Uses the existing addDelivery/deleteDelivery context +
 * uploadImage; no backend or email involved.
 */
export function DeliverablesManager({ projectId, tasks }: { projectId: string; tasks: TimelineTask[] }) {
  const { projects, addDelivery, deleteDelivery } = useProjects();
  const { toast } = useToast();
  const project = projects.find((p) => p.id === projectId);
  const deliveries = project?.deliveries ?? [];

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Delivery["type"]>("link");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [taskId, setTaskId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<Delivery | null>(null);

  const taskTitle = (tid?: string) => tasks.find((t) => t.id === tid)?.title;

  function reset() {
    setTitle(""); setType("link"); setContent(""); setImages([]); setTaskId(""); setDescription(""); setAdding(false);
  }

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setImages((prev) => [...prev, url]);
    } catch {
      toast({ title: "Upload échoué", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function handleAdd() {
    if (!title.trim()) { toast({ title: "Titre requis", variant: "destructive" }); return; }
    if (type === "image") {
      if (images.length === 0) { toast({ title: "Ajoutez au moins une image", variant: "destructive" }); return; }
    } else if (!content.trim()) {
      toast({ title: type === "text" ? "Texte requis" : "URL requise", variant: "destructive" });
      return;
    }
    addDelivery(projectId, {
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      content: type === "image" ? (images[0] ?? "") : content.trim(),
      images: type === "image" ? images : undefined,
      taskId: taskId || undefined,
    });
    toast({ title: "Livrable ajouté" });
    reset();
  }

  return (
    <div className="space-y-4">
      {deliveries.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground font-body py-8">
          Aucun livrable. Ajoutez des liens, images ou fichiers — ils apparaîtront dans l'espace client.
        </p>
      ) : (
        <ul className="space-y-2">
          {deliveries.map((d) => {
            const Icon = TYPE_META[d.type]?.icon ?? Package;
            const step = taskTitle(d.taskId);
            const count = d.images?.length ?? (d.content ? 1 : 0);
            return (
              <li key={d.id} className="flex items-start gap-3 bg-card border border-border rounded-xl p-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-body text-sm font-medium text-foreground break-words">{d.title}</span>
                    {step ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">{step}</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-primary/30 text-primary">Final</span>
                    )}
                  </div>
                  {d.description && <p className="text-xs text-muted-foreground font-body mt-0.5 break-words">{d.description}</p>}
                  {d.type === "image" ? (
                    <p className="text-[11px] text-muted-foreground/60 font-body mt-0.5">{count} image{count > 1 ? "s" : ""}</p>
                  ) : d.content ? (
                    <a href={d.content} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline font-body mt-0.5 inline-flex items-center gap-1 break-all">
                      <ExternalLink size={10} /> {d.content}
                    </a>
                  ) : null}
                </div>
                <button onClick={() => setToDelete(d)} className="p-1.5 text-muted-foreground/50 hover:text-destructive transition-colors shrink-0" title="Supprimer">
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!adding ? (
        <Button onClick={() => setAdding(true)} variant="outline" size="sm" className="gap-1.5">
          <Plus size={14} /> Ajouter un livrable
        </Button>
      ) : (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Titre</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Maquettes v2, Site de préprod…" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Type</label>
              <Select value={type} onValueChange={(v) => setType(v as Delivery["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_META) as Delivery["type"][]).map((k) => (
                    <SelectItem key={k} value={k}>{TYPE_META[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Rattacher à</label>
              <Select value={taskId || "__final__"} onValueChange={(v) => setTaskId(v === "__final__" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__final__">Livrable final</SelectItem>
                  {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "image" ? (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Images</label>
              <div className="flex items-center gap-2 flex-wrap">
                {images.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-border" />
                    <button
                      onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <label className="w-16 h-16 rounded-lg border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-secondary/40 transition-colors">
                  {uploading ? <Loader2 size={16} className="animate-spin text-muted-foreground" /> : <Upload size={16} className="text-muted-foreground" />}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { onPickImage(e.target.files?.[0]); e.currentTarget.value = ""; }} />
                </label>
              </div>
            </div>
          ) : type === "text" ? (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Texte</label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} placeholder="Note pour le client…" />
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">URL</label>
              <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="https://…" />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Description (optionnel)</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contexte, instructions…" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={reset}>Annuler</Button>
            <Button size="sm" onClick={handleAdd} disabled={uploading} className="gap-1.5"><Plus size={14} /> Ajouter</Button>
          </div>
        </div>
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce livrable ?</AlertDialogTitle>
            <AlertDialogDescription>« {toDelete?.title} » sera retiré de l'espace client. Action définitive.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (toDelete) { deleteDelivery(projectId, toDelete.id); setToDelete(null); } }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
