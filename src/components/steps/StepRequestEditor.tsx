import { useState, useRef, useCallback } from "react";
import {
  MessageSquare, Image, Vote, FileUp, Type, PlusCircle, Trash2, CircleDot, Upload, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadImage } from "@/api/projects";
import { useToast } from "@/hooks/use-toast";
import type { VoteOption, FeedbackRequest, GuidedQuestion } from "@/types/timeline";

type RequestType = "text" | "file" | "validation" | "vote";

const REQUEST_TYPE_CONFIG: Record<RequestType, { label: string; icon: typeof Type; description: string }> = {
  text:       { label: "Texte",       icon: MessageSquare, description: "Le client repond par texte" },
  file:       { label: "Fichier",     icon: FileUp,        description: "Le client envoie un fichier ou un lien" },
  validation: { label: "Validation",  icon: Image,         description: "Montrer des images, le client approuve" },
  vote:       { label: "Vote",        icon: Vote,          description: "Options nommees, le client choisit" },
};

interface FeedbackTemplate {
  id: string;
  label: string;
  type: RequestType;
  message: string;
  guidedQuestions?: Omit<GuidedQuestion, "id">[];
}

const FEEDBACK_TEMPLATES: FeedbackTemplate[] = [
  {
    id: "design-validation",
    label: "Validation de design",
    type: "validation",
    message: "Merci de valider le design ci-dessous. Verifiez les couleurs, la typographie et la mise en page.",
    guidedQuestions: [
      { type: "yesno", question: "Les couleurs correspondent-elles a votre identite ?", required: true },
      { type: "yesno", question: "La mise en page est-elle claire et lisible ?", required: true },
      { type: "text", question: "Remarques supplementaires", required: false },
    ],
  },
  {
    id: "logo-choice",
    label: "Choix de direction (logo/design)",
    type: "vote",
    message: "Quelle direction preferez-vous ? Ce n'est pas un choix definitif — nous affinerons ensemble.",
  },
  {
    id: "content-review",
    label: "Relecture de contenu",
    type: "validation",
    message: "Merci de relire les textes ci-dessous et de verifier que les informations sont correctes.",
    guidedQuestions: [
      { type: "yesno", question: "Les informations de contact sont-elles correctes ?", required: true },
      { type: "yesno", question: "Le ton correspond-il a votre marque ?", required: true },
      { type: "checkbox", question: "Quels aspects necessitent des corrections ?", options: ["Orthographe", "Informations factuelles", "Ton/style", "Mise en page"], required: false },
    ],
  },
  {
    id: "file-request",
    label: "Demande de fichier/document",
    type: "file",
    message: "Merci de fournir les documents suivants pour avancer sur votre projet.",
  },
  {
    id: "general-feedback",
    label: "Retour general",
    type: "text",
    message: "Nous aimerions avoir votre avis sur cette etape.",
    guidedQuestions: [
      { type: "rating", question: "Satisfaction globale sur cette etape", required: true },
      { type: "text", question: "Que pourrions-nous ameliorer ?", required: false },
    ],
  },
  {
    id: "final-approval",
    label: "Approbation finale (mise en ligne)",
    type: "validation",
    message: "Votre projet est pret a etre publie. Merci de verifier une derniere fois et de donner votre accord.",
    guidedQuestions: [
      { type: "yesno", question: "Toutes les pages ont-elles ete verifiees ?", required: true },
      { type: "yesno", question: "Les formulaires et liens fonctionnent-ils ?", required: true },
      { type: "yesno", question: "Confirmez-vous la mise en ligne ?", required: true },
    ],
  },
];

function ImageUploadInput({ onUrl, placeholder }: { onUrl: (url: string) => void; placeholder?: string }) {
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const imageUrl = await uploadImage(file);
      setUrl(imageUrl);
      onUrl(imageUrl);
      toast({ title: "Image telechargee" });
    } catch {
      toast({ title: "Echec du telechargement", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [onUrl, toast]);

  return (
    <div className="flex gap-2 items-center">
      <Input
        placeholder={placeholder || "URL de l'image"}
        value={url}
        onChange={(e) => { setUrl(e.target.value); onUrl(e.target.value); }}
        className="text-xs h-8 flex-1"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="p-1.5 rounded border border-border hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
      >
        <Upload size={14} className={uploading ? "animate-pulse" : ""} />
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

interface Props {
  onAdd: (r: Omit<FeedbackRequest, "id" | "createdAt" | "resolved">) => void;
  onCancel: () => void;
}

export function StepRequestEditor({ onAdd, onCancel }: Props) {
  const [type, setType] = useState<RequestType>("text");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([""]);
  const [options, setOptions] = useState<VoteOption[]>([
    { id: crypto.randomUUID(), label: "Version A", description: "" },
    { id: crypto.randomUUID(), label: "Version B", description: "" },
  ]);
  const [guidedQuestions, setGuidedQuestions] = useState<GuidedQuestion[]>([]);
  const [deadline, setDeadline] = useState("");
  const [revisionLimit, setRevisionLimit] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  function applyTemplate(templateId: string) {
    const tpl = FEEDBACK_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setType(tpl.type);
    setMessage(tpl.message);
    if (tpl.guidedQuestions) {
      setGuidedQuestions(tpl.guidedQuestions.map((q) => ({ ...q, id: crypto.randomUUID() })));
    } else {
      setGuidedQuestions([]);
    }
  }

  const canSubmit = message.trim() && (
    type === "text" || type === "file" ||
    (type === "validation" && images.some((u) => u.trim())) ||
    (type === "vote" && options.filter((o) => o.label.trim()).length >= 2)
  );

  function handleSubmit() {
    if (!canSubmit) return;
    const payload: Omit<FeedbackRequest, "id" | "createdAt" | "resolved"> = {
      type,
      message: message.trim(),
    };
    if (type === "validation") payload.images = images.filter((u) => u.trim());
    if (type === "vote") payload.options = options.filter((o) => o.label.trim()).map((o) => ({
      ...o,
      images: (o.images && o.images.length > 0) ? o.images : (o.imageUrl ? [o.imageUrl] : undefined),
    })) as VoteOption[];
    if (guidedQuestions.length > 0) payload.guidedQuestions = guidedQuestions;
    if (deadline.trim()) payload.deadline = deadline.trim();
    if (revisionLimit.trim()) payload.revisionLimit = parseInt(revisionLimit, 10) || undefined;
    onAdd(payload);
  }

  return (
    <div className="p-4 space-y-3 bg-background/60 border border-border/50 rounded-lg">
      <div className="flex items-center justify-between">
        <p className="font-display text-xs font-semibold text-foreground">Nouvelle demande client</p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>

      {/* Template presets */}
      <div>
        <label className="font-body text-[10px] text-muted-foreground mb-0.5 block">Modele</label>
        <select
          onChange={(e) => { if (e.target.value) applyTemplate(e.target.value); }}
          className="w-full text-xs h-8 rounded-md border border-border bg-background px-2 font-body text-foreground"
          defaultValue=""
        >
          <option value="" className="text-foreground bg-background">Personnalise</option>
          {FEEDBACK_TEMPLATES.map((tpl) => (
            <option key={tpl.id} value={tpl.id} className="text-foreground bg-background">{tpl.label}</option>
          ))}
        </select>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(REQUEST_TYPE_CONFIG) as RequestType[]).map((t) => {
          const cfg = REQUEST_TYPE_CONFIG[t];
          const Icon = cfg.icon;
          return (
            <button
              key={t} type="button" onClick={() => setType(t)}
              className={cn(
                "flex items-center gap-1.5 p-2 rounded-lg border text-left transition-colors",
                type === t
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              )}
            >
              <Icon size={12} />
              <div>
                <p className="font-display text-[10px] font-semibold leading-tight">{cfg.label}</p>
                <p className="font-body text-[9px] opacity-60">{cfg.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Message */}
      <Input
        placeholder="Que demandez-vous au client ? Soyez clair et precis."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="text-xs"
      />

      {/* Validation images */}
      {type === "validation" && (
        <div className="space-y-1.5">
          <label className="font-body text-[10px] text-muted-foreground">Images a montrer</label>
          {images.map((img, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="flex-1">
                <ImageUploadInput
                  placeholder={`Image ${i + 1}`}
                  onUrl={(url) => setImages((prev) => prev.map((v, idx) => idx === i ? url : v))}
                />
              </div>
              {images.length > 1 && (
                <button onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-destructive">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
          {images.length < 5 && (
            <button onClick={() => setImages((prev) => [...prev, ""])}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-body">
              <PlusCircle size={10} /> Ajouter une image
            </button>
          )}
        </div>
      )}

      {/* Vote options */}
      {type === "vote" && (
        <div className="space-y-1.5">
          <label className="font-body text-[10px] text-muted-foreground">Options (min 2, max 4)</label>
          {options.map((opt, i) => (
            <div key={opt.id} className={cn("bg-secondary/20 rounded-lg p-2 space-y-1.5", opt.isRecommended && "ring-1 ring-amber-300/50")}>
              <div className="flex items-center gap-1.5">
                <Input placeholder={`Nom de l'option (ex: Direction ${String.fromCharCode(65 + i)})`} value={opt.label}
                  onChange={(e) => setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, label: e.target.value } : o))}
                  className="text-xs h-7 flex-1" />
                <button
                  onClick={() => setOptions((prev) => prev.map((o, idx) => ({ ...o, isRecommended: idx === i ? !o.isRecommended : false })))}
                  className={cn("p-1 rounded transition-colors", opt.isRecommended ? "text-amber-500" : "text-muted-foreground/40 hover:text-amber-400")}
                  title="Recommande"
                >
                  <CircleDot size={12} />
                </button>
                {options.length > 2 && (
                  <button onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive"><Trash2 size={10} /></button>
                )}
              </div>
              <Input placeholder="Impact ou contexte (ex: 'Ajoute 1 semaine au planning')" value={opt.description || ""}
                onChange={(e) => setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, description: e.target.value } : o))}
                className="text-xs h-7" />

              {/* Multi-image upload for option */}
              <div className="space-y-1">
                {(opt.images && opt.images.length > 0 ? opt.images : [opt.imageUrl || ""]).map((imgUrl, imgIdx) => (
                  <div key={imgIdx} className="flex gap-1.5 items-center">
                    <div className="flex-1">
                      <ImageUploadInput
                        placeholder={`Image ${imgIdx + 1}`}
                        onUrl={(url) => {
                          setOptions((prev) => prev.map((o, idx) => {
                            if (idx !== i) return o;
                            const imgs = [...(o.images && o.images.length > 0 ? o.images : [o.imageUrl || ""])];
                            imgs[imgIdx] = url;
                            return { ...o, images: imgs, imageUrl: imgs[0] || "" };
                          }));
                        }}
                      />
                    </div>
                    {(opt.images?.length || 1) > 1 && (
                      <button onClick={() => {
                        setOptions((prev) => prev.map((o, idx) => {
                          if (idx !== i) return o;
                          const imgs = [...(o.images || [])].filter((_, j) => j !== imgIdx);
                          return { ...o, images: imgs, imageUrl: imgs[0] || "" };
                        }));
                      }} className="text-muted-foreground hover:text-destructive"><Trash2 size={9} /></button>
                    )}
                  </div>
                ))}
                {(opt.images?.length || 1) < 5 && (
                  <button onClick={() => {
                    setOptions((prev) => prev.map((o, idx) => {
                      if (idx !== i) return o;
                      const imgs = [...(o.images && o.images.length > 0 ? o.images : [o.imageUrl || ""]), ""];
                      return { ...o, images: imgs };
                    }));
                  }} className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground font-body">
                    <PlusCircle size={9} /> Image
                  </button>
                )}
              </div>

              <Input placeholder="Lien de previsualisation (optionnel)" value={opt.linkUrl || ""}
                onChange={(e) => setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, linkUrl: e.target.value } : o))}
                className="text-xs h-7" />
            </div>
          ))}
          {options.length < 4 && (
            <button
              onClick={() => setOptions((prev) => [...prev, { id: crypto.randomUUID(), label: `Version ${String.fromCharCode(65 + prev.length)}`, description: "" }])}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-body">
              <PlusCircle size={10} /> Ajouter une option
            </button>
          )}
        </div>
      )}

      {/* Guided questions preview */}
      {guidedQuestions.length > 0 && (
        <div className="space-y-1.5">
          <label className="font-body text-[10px] text-muted-foreground">Questions guidees ({guidedQuestions.length})</label>
          {guidedQuestions.map((q, i) => (
            <div key={q.id} className="flex items-center gap-1.5 text-[10px] font-body bg-secondary/30 rounded px-2 py-1.5">
              <span className="text-muted-foreground shrink-0">{q.type === "yesno" ? "Oui/Non" : q.type === "rating" ? "Note" : q.type === "checkbox" ? "Cases" : "Texte"}</span>
              <span className="text-foreground/80 flex-1 truncate">{q.question}</span>
              {q.required && <span className="text-red-500 shrink-0">*</span>}
              <button onClick={() => setGuidedQuestions((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 size={9} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Advanced */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-[10px] font-body text-muted-foreground/50 hover:text-muted-foreground"
      >
        {showAdvanced ? "Masquer les options" : "Options avancees"}
      </button>
      {showAdvanced && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] font-body text-muted-foreground mb-0.5 block">Date limite</label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="text-xs h-7" />
          </div>
          <div className="w-24">
            <label className="text-[10px] font-body text-muted-foreground mb-0.5 block">Max revisions</label>
            <Input type="number" min={1} value={revisionLimit} onChange={(e) => setRevisionLimit(e.target.value)} className="text-xs h-7" />
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1 text-xs">
          Annuler
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={!canSubmit} className="flex-1 text-xs">
          Ajouter la demande
        </Button>
      </div>
    </div>
  );
}
