import { useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";
import { useClients } from "@/contexts/ClientsContext";
import { getClientAuth, setClientAuth } from "@/lib/auth";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RichText } from "@/components/RichText";
import {
  AlertTriangle, CheckCircle2, Circle, ChevronDown, ChevronUp,
  Send, CalendarDays, User, FileText, ZoomIn, ThumbsUp, ThumbsDown,
  Upload, Vote, Link2, Image, AlignLeft, Download, Package,
  X, ChevronLeft, ChevronRight, ExternalLink, FileDown, Loader2, Sparkles,
  ClipboardList, Eye, MessageSquare, RefreshCw, ArrowRight, Star, Maximize2, Copy, Check, Users,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { FeedbackRequest, VoteOption, GuidedQuestion } from "@/types/timeline";
import { OptionImageGallery } from "@/components/funnel/OptionImageGallery";
import { RevisionCounter } from "@/components/feedback/RevisionCounter";
import { FeedbackAuditLog } from "@/components/feedback/FeedbackAuditLog";
import { StakeholderVoteSummary } from "@/components/feedback/StakeholderVoteSummary";
import { ProjectData, Delivery } from "@/types/project";
import { cn } from "@/lib/utils";
import { printViaIframe } from "@/lib/printUtils";
import { listProjectQuotes, updateQuote } from "@/api/quotes";
import { Quote, totalQuote } from "@/types/quote";
import { getCadrage, type Cadrage } from "@/api/cadrage";

// ── Color maps ────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  primary: "bg-primary", accent: "bg-accent", secondary: "bg-secondary",
  rose: "bg-palette-rose", sage: "bg-palette-sage", amber: "bg-palette-amber", violet: "bg-palette-violet",
};

// ── Welcome Onboarding Carousel ──────────────────────────────

function WelcomeOnboarding({ clientName, projectTitle, onDismiss }: {
  clientName?: string;
  projectTitle: string;
  onDismiss: () => void;
}) {
  const [step, setStep] = useState(0);
  const touchStartX = useRef(0);
  const TOTAL_STEPS = 3;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0 && step < TOTAL_STEPS - 1) setStep(step + 1);
      if (delta > 0 && step > 0) setStep(step - 1);
    }
  }

  const PROCESS_STEPS = [
    { icon: ClipboardList, title: "Etapes claires", desc: "Votre projet est divisé en étapes. Chaque étape nécessite votre validation avant de passer à la suite." },
    { icon: CheckCircle2, title: "Validation", desc: "Approuvez les livrables, choisissez parmi les options proposées, ou demandez une révision." },
    { icon: MessageSquare, title: "Communication", desc: "Ajoutez des commentaires sur chaque étape pour donner votre retour directement." },
    { icon: Eye, title: "Suivi en temps réel", desc: "Suivez l'avancement global et voyez exactement où en est votre projet." },
  ];

  const ACTION_CARDS = [
    { icon: ThumbsUp, title: "Valider une étape", desc: "Quand une étape est prête, cliquez sur Valider pour confirmer.", color: "text-emerald-600 bg-emerald-50" },
    { icon: RefreshCw, title: "Demander une révision", desc: "Pas satisfait ? Demandez une révision avec un commentaire.", color: "text-amber-600 bg-amber-50" },
    { icon: FileText, title: "Consulter les fichiers", desc: "Accédez aux documents, maquettes et livrables partagés.", color: "text-blue-600 bg-blue-50" },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Carousel */}
        <div
          className="overflow-hidden rounded-2xl"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${step * 100}%)` }}
          >
            {/* Screen 1: Welcome */}
            <div className="w-full shrink-0 px-2">
              <div className="text-center space-y-5 py-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto">
                  <Sparkles size={28} className="text-primary" />
                </div>
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                    Bienvenue{clientName ? `, ${clientName}` : ""} !
                  </h1>
                  <p className="font-body text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    Voici votre espace projet pour <strong>{projectTitle}</strong>.
                  </p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-left">
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">
                    Ce portail vous permet de suivre chaque étape, valider les livrables et communiquer directement avec l'équipe.
                  </p>
                </div>
              </div>
            </div>

            {/* Screen 2: How it works */}
            <div className="w-full shrink-0 px-2">
              <div className="space-y-4 py-6">
                <h2 className="font-display text-lg font-bold text-foreground text-center">
                  Comment ça fonctionne
                </h2>
                <div className="space-y-3">
                  {PROCESS_STEPS.map((s, i) => (
                    <div key={i} className="flex gap-3 items-start bg-card border border-border rounded-xl p-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <s.icon size={16} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-body text-sm font-semibold text-foreground">{s.title}</p>
                        <p className="font-body text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Screen 3: Your actions */}
            <div className="w-full shrink-0 px-2">
              <div className="space-y-4 py-6">
                <h2 className="font-display text-lg font-bold text-foreground text-center">
                  Vos actions
                </h2>
                <div className="space-y-3">
                  {ACTION_CARDS.map((a, i) => (
                    <div key={i} className="flex gap-3 items-start bg-card border border-border rounded-xl p-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", a.color)}>
                        <a.icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-body text-sm font-semibold text-foreground">{a.title}</p>
                        <p className="font-body text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i === step ? "bg-primary w-6" : "bg-border hover:bg-muted-foreground/30",
              )}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 px-2">
          <button
            onClick={() => setStep(step - 1)}
            className={cn(
              "font-body text-sm text-muted-foreground hover:text-foreground transition-colors",
              step === 0 && "invisible",
            )}
          >
            <ChevronLeft size={14} className="inline -mt-0.5" /> Précédent
          </button>

          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="font-body text-sm text-primary font-medium hover:text-primary/80 transition-colors"
            >
              Suivant <ChevronRight size={14} className="inline -mt-0.5" />
            </button>
          ) : (
            <Button onClick={onDismiss} className="gap-2 h-10 px-6">
              Voir mon projet
            </Button>
          )}
        </div>

        {/* Skip link */}
        {step < TOTAL_STEPS - 1 && (
          <div className="text-center mt-4">
            <button
              onClick={onDismiss}
              className="font-body text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Passer l'introduction
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<ProjectData["status"], { label: string; className: string }> = {
  draft:         { label: "Brouillon",   className: "bg-muted text-muted-foreground border-border" },
  "in-progress": { label: "En cours",    className: "bg-primary/10 text-primary border-primary/30" },
  completed:     { label: "Terminé",     className: "bg-palette-sage/20 text-palette-sage border-palette-sage/30" },
  "on-hold":     { label: "En pause",    className: "bg-palette-amber/20 text-palette-amber border-palette-amber/30" },
};

const INVOICE_STATUS: Record<string, { label: string; className: string }> = {
  draft:         { label: "Brouillon",   className: "bg-muted text-muted-foreground border-border" },
  "to-validate": { label: "En attente",  className: "bg-palette-amber/15 text-palette-amber border-palette-amber/30" },
  validated:     { label: "Validé",      className: "bg-palette-sage/15 text-palette-sage border-palette-sage/30" },
  paid:          { label: "Payé",        className: "bg-primary/10 text-primary border-primary/30" },
  "on-hold":     { label: "En pause",    className: "bg-palette-rose/15 text-palette-rose border-palette-rose/30" },
};

// ── Image Lightbox ────────────────────────────────────────────

function ImageLightbox({ delivery, initialIndex, onClose }: {
  delivery: Delivery;
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const imgs = (delivery.images?.filter(Boolean).length ? delivery.images! : [delivery.content]).filter(Boolean);
  const total = imgs.length;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(total - 1, i + 1));
      if (e.key === "ArrowLeft")  setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [total, onClose]);

  const TYPE_ICON: Record<string, React.ReactNode> = {
    image: <Image size={13} className="text-palette-violet" />,
    link:  <Link2 size={13} className="text-primary" />,
    file:  <Download size={13} className="text-palette-amber" />,
    text:  <AlignLeft size={13} className="text-palette-sage" />,
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex"
      onClick={onClose}
    >
      {/* Left panel */}
      <div
        className="w-64 shrink-0 bg-black/60 border-r border-white/10 flex flex-col p-5 gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="self-start p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex-1 min-h-0">
          <div className="flex items-center gap-1.5 mb-3">
            {TYPE_ICON[delivery.type]}
            <span className="font-body text-[10px] uppercase tracking-widest text-white/40">{delivery.type}</span>
          </div>
          <h3 className="font-display text-white text-base font-bold leading-snug mb-2">{delivery.title}</h3>
          {delivery.description && (
            <p className="font-body text-sm text-white/50 leading-relaxed">{delivery.description}</p>
          )}
        </div>

        {/* Thumbnail strip */}
        {total > 1 && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
            {imgs.map((url, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={cn(
                  "w-12 h-12 rounded-md overflow-hidden border-2 transition-all",
                  i === idx ? "border-white opacity-100" : "border-transparent opacity-40 hover:opacity-70"
                )}
              >
                <img src={url} alt={`${delivery.title} ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {total > 1 && (
          <p className="font-body text-xs text-white/30 text-center">{idx + 1} / {total}</p>
        )}
      </div>

      {/* Right: main image */}
      <div
        className="flex-1 flex items-center justify-center relative p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {total > 1 && (
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="absolute left-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 transition-all z-10"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        <img
          src={imgs[idx]}
          alt={`${delivery.title} ${idx + 1}`}
          className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          style={{ maxHeight: "calc(100vh - 3rem)" }}
        />

        {total > 1 && (
          <button
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            disabled={idx === total - 1}
            className="absolute right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 transition-all z-10"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Delivery Card ─────────────────────────────────────────────

function DeliveryCard({ d, onLightbox, isFinal = false }: {
  d: Delivery & { createdAt?: string };
  onLightbox: (index: number) => void;
  isFinal?: boolean;
}) {
  const isLink  = d.type === "link";
  const isImage = d.type === "image";
  const isText  = d.type === "text";
  const imgs    = isImage ? (d.images?.filter(Boolean).length ? d.images! : [d.content]).filter(Boolean) : [];

  const iconBg = isLink ? "bg-primary/10" : isImage ? "bg-palette-violet/10" : isText ? "bg-palette-sage/10" : "bg-palette-amber/10";
  const icon   = isLink  ? <Link2 size={15} className="text-primary" />
               : isImage ? <Image size={15} className="text-palette-violet" />
               : isText  ? <AlignLeft size={15} className="text-palette-sage" />
               :            <Download size={15} className="text-palette-amber" />;

  const inner = (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Multi-image grid */}
      {isImage && imgs.length > 0 && (
        <div className={cn("grid gap-0.5 bg-secondary/20", imgs.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
          {imgs.slice(0, 4).map((url, i) => {
            const isOverlay = i === 3 && imgs.length > 4;
            return (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLightbox(i); }}
                className="relative aspect-video overflow-hidden group"
              >
                <img src={url} alt={`${d.title} ${i + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                {isOverlay && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="font-display text-white font-bold text-lg">+{imgs.length - 3}</span>
                  </div>
                )}
                {!isOverlay && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                    <ZoomIn size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <p className="font-display text-sm font-semibold text-foreground truncate">{d.title}</p>
              {isFinal && (
                <span className="font-body text-[9px] uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 shrink-0">Final</span>
              )}
            </div>
            {d.createdAt && (
              <p className="font-body text-[10px] text-muted-foreground/60 mb-1">
                {new Date(d.createdAt).toLocaleDateString()}
              </p>
            )}
            {d.description && (
              <p className="font-body text-xs text-muted-foreground mb-2 line-clamp-2">{d.description}</p>
            )}
            {isText && d.content && (
              <div className="bg-secondary/40 rounded-lg p-3 mt-1">
                <p className="font-body text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{d.content}</p>
              </div>
            )}
            {d.type === "file" && d.content && (
              <span className="inline-flex items-center gap-1.5 font-body text-xs bg-secondary text-foreground px-3 py-1.5 rounded-lg mt-1">
                <Download size={12} /> Télécharger le fichier
              </span>
            )}
            {isLink && (
              <span className="inline-flex items-center gap-1 font-body text-xs text-primary mt-1">
                Ouvrir le lien <ExternalLink size={10} />
              </span>
            )}
            {isImage && imgs.length > 0 && (
              <span className="font-body text-[10px] text-muted-foreground mt-1 inline-block">
                {imgs.length} image{imgs.length > 1 ? "s" : ""} · cliquez pour agrandir
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (isLink && d.content) {
    return (
      <a href={d.content} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
        {inner}
      </a>
    );
  }

  return inner;
}

// ── File Drop Zone ────────────────────────────────────────────

function FileDropZone({ onFile }: { onFile: (name: string) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName]     = useState<string | null>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) { setFileName(file.name); onFile(file.name); }
  }, [onFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setFileName(file.name); onFile(file.name); }
  }, [onFile]);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
        isDragging ? "border-palette-amber bg-palette-amber/10" : "border-border hover:border-palette-amber/50 hover:bg-secondary/30"
      )}
    >
      <input ref={inputRef} type="file" className="hidden" onChange={handleChange} />
      {fileName ? (
        <div className="flex items-center justify-center gap-2 text-xs font-body text-palette-sage">
          <CheckCircle2 size={14} /> <span className="font-medium">{fileName}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <Upload size={20} className="text-muted-foreground" />
          <p className="font-body text-xs text-muted-foreground"><span className="font-semibold text-foreground">Déposez un fichier ici</span> ou cliquez pour parcourir</p>
        </div>
      )}
    </div>
  );
}

// ── Deadline Badge Helper ─────────────────────────────────────

function DeadlineBadge({ deadline }: { deadline: string }) {
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isOverdue = days < 0;
  const isUrgent = days >= 0 && days <= 3;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 font-body text-[10px]",
      isOverdue ? "text-red-600" : isUrgent ? "text-amber-600" : "text-muted-foreground",
    )}>
      <CalendarDays size={10} />
      {isOverdue
        ? "Echéance dépassée"
        : days === 0
          ? "Aujourd'hui"
          : `${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}`
      }
    </span>
  );
}

// ── Guided Questions Form ────────────────────────────────────

function GuidedQuestionsForm({ questions, onSubmit }: {
  questions: GuidedQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const update = (id: string, value: string) => setAnswers((prev) => ({ ...prev, [id]: value }));

  const allRequired = questions.filter((q) => q.required).every((q) => answers[q.id]?.trim());

  return (
    <div className="space-y-4">
      {questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <label className="font-body text-xs font-semibold text-foreground flex items-center gap-1">
            {q.question}
            {q.required && <span className="text-red-500">*</span>}
          </label>

          {q.type === "text" && (
            <Input
              placeholder="Votre réponse..."
              value={answers[q.id] || ""}
              onChange={(e) => update(q.id, e.target.value)}
              className="text-xs h-9"
            />
          )}

          {q.type === "rating" && (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => update(q.id, String(n))}
                  className={cn(
                    "w-9 h-9 rounded-lg border-2 font-display text-sm font-bold transition-all",
                    Number(answers[q.id]) === n
                      ? "border-primary bg-primary text-white"
                      : "border-border hover:border-primary/40 text-muted-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
              <span className="font-body text-[10px] text-muted-foreground ml-2">
                {Number(answers[q.id]) >= 4 ? "Excellent" : Number(answers[q.id]) >= 2 ? "Correct" : answers[q.id] ? "A revoir" : ""}
              </span>
            </div>
          )}

          {q.type === "yesno" && (
            <div className="flex gap-2">
              {[{ val: "Oui", icon: ThumbsUp }, { val: "Non", icon: ThumbsDown }].map(({ val, icon: Icon }) => (
                <button
                  key={val}
                  onClick={() => update(q.id, val)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-body text-xs font-semibold transition-all",
                    answers[q.id] === val
                      ? val === "Oui" ? "border-emerald-500 bg-emerald-500 text-white" : "border-amber-500 bg-amber-500 text-white"
                      : "border-border hover:border-muted-foreground/40 text-foreground",
                  )}
                >
                  <Icon size={13} /> {val}
                </button>
              ))}
            </div>
          )}

          {q.type === "checkbox" && q.options && (
            <div className="space-y-1.5">
              {q.options.map((opt) => {
                const selected = (answers[q.id] || "").split(";;").filter(Boolean);
                const isChecked = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      const next = isChecked ? selected.filter((s) => s !== opt) : [...selected, opt];
                      update(q.id, next.join(";;"));
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border text-xs font-body transition-all",
                      isChecked
                        ? "border-primary/40 bg-primary/5 text-foreground"
                        : "border-border hover:border-primary/30 text-foreground/80",
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0",
                      isChecked ? "border-primary bg-primary" : "border-border",
                    )}>
                      {isChecked && <CheckCircle2 size={10} className="text-white" />}
                    </div>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <Button
        className="w-full gap-2"
        disabled={!allRequired}
        onClick={() => onSubmit(answers)}
      >
        <Send size={14} /> Envoyer mes réponses
      </Button>
    </div>
  );
}

// ── Validation Card ───────────────────────────────────────────

function ValidationCard({ request, onRespond }: { request: FeedbackRequest; onRespond: (r: string) => void }) {
  const [choice, setChoice]           = useState<"approved" | "changes" | null>(null);
  const [changesNote, setChangesNote] = useState("");
  const [guidedAnswers, setGuidedAnswers] = useState<Record<string, string>>({});

  const hasImages = request.images && request.images.length > 0;
  const hasGuided = request.guidedQuestions && request.guidedQuestions.length > 0;
  const atRevisionLimit = request.revisionLimit != null && (request.revisionCount ?? 0) >= request.revisionLimit;

  return (
    <div className="bg-card border-2 border-primary/30 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 font-semibold">APPROBATION REQUISE</Badge>
            {request.deadline && <DeadlineBadge deadline={request.deadline} />}
          </div>
          <p className="font-display text-sm font-semibold text-foreground">{request.message}</p>
          {request.revisionLimit != null && (
            <div className="mt-1.5">
              <RevisionCounter current={request.revisionCount ?? 0} limit={request.revisionLimit} compact />
            </div>
          )}
        </div>
      </div>

      {/* Image gallery using OptionImageGallery */}
      {hasImages && (
        <OptionImageGallery
          images={request.images!}
          alt="Design"
          variant="compact"
          className="rounded-lg overflow-hidden"
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setChoice("approved")}
          className={cn(
            "flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-display text-sm font-semibold transition-all",
            choice === "approved"
              ? "border-palette-sage bg-palette-sage text-white"
              : "border-border hover:border-palette-sage/50 hover:bg-palette-sage/5 text-foreground"
          )}
        >
          <ThumbsUp size={16} /> Approuver
        </button>
        <button
          onClick={() => setChoice("changes")}
          disabled={atRevisionLimit}
          className={cn(
            "flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-display text-sm font-semibold transition-all",
            atRevisionLimit
              ? "border-border text-muted-foreground/50 cursor-not-allowed"
              : choice === "changes"
                ? "border-palette-amber bg-palette-amber text-white"
                : "border-border hover:border-palette-amber/50 hover:bg-palette-amber/5 text-foreground"
          )}
        >
          <ThumbsDown size={16} /> Demander des modifications
        </button>
      </div>

      {/* Revision limit message */}
      {atRevisionLimit && (
        <p className="text-xs font-body text-amber-600 bg-amber-50 rounded-lg p-2">
          Le nombre maximum de revisions est atteint. Des revisions supplementaires sont disponibles sur devis.
        </p>
      )}
      {request.revisionLimit != null && !atRevisionLimit && (
        <p className="text-[10px] font-body text-muted-foreground">
          Un tour de revision = un lot de retours regroupes.
        </p>
      )}

      {choice === "changes" && (
        <Textarea
          placeholder="Decrivez les modifications souhaitees : couleurs, textes, mise en page, images..."
          value={changesNote}
          onChange={(e) => setChangesNote(e.target.value)}
          rows={3}
          className="text-sm resize-none"
          autoFocus
        />
      )}

      {/* Guided questions (if any) */}
      {hasGuided && choice && (
        <GuidedQuestionsForm
          questions={request.guidedQuestions!}
          onSubmit={(answers) => {
            const formatted = Object.entries(answers)
              .map(([qId, val]) => {
                const q = request.guidedQuestions!.find((gq) => gq.id === qId);
                return q ? `${q.question}: ${val}` : val;
              })
              .join("\n");
            if (choice === "approved") onRespond(`approved\n---\n${formatted}`);
            else if (changesNote.trim()) onRespond(`changes: ${changesNote.trim()}\n---\n${formatted}`);
          }}
        />
      )}

      {choice && !hasGuided && (
        <Button
          className="w-full gap-2"
          disabled={choice === "changes" && !changesNote.trim()}
          onClick={() => {
            if (choice === "approved") onRespond("approved");
            else if (changesNote.trim()) onRespond(`changes: ${changesNote.trim()}`);
          }}
        >
          <Send size={14} />
          {choice === "approved" ? "Confirmer l'approbation" : "Envoyer le retour"}
        </Button>
      )}

      {/* Audit log */}
      {request.responseHistory && request.responseHistory.length > 0 && (
        <FeedbackAuditLog history={request.responseHistory} />
      )}

      {/* Stakeholder votes */}
      {request.stakeholderVotes && request.stakeholderVotes.length > 0 && (
        <StakeholderVoteSummary votes={request.stakeholderVotes} type="validation" />
      )}
    </div>
  );
}

// ── Vote Card ─────────────────────────────────────────────────

function VoteCard({ request, onRespond, projectId, taskId }: {
  request: FeedbackRequest;
  onRespond: (r: string) => void;
  projectId?: string;
  taskId?: string;
}) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const options: VoteOption[] = request.options || [];

  const getOptionImages = (opt: VoteOption): string[] => {
    if (opt.images && opt.images.length > 0) return opt.images;
    if (opt.imageUrl) return [opt.imageUrl];
    return [];
  };

  return (
    <div className="bg-card border-2 border-palette-violet/30 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-palette-violet/10 flex items-center justify-center flex-shrink-0">
          <Vote size={16} className="text-palette-violet" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className="text-[10px] bg-palette-violet/10 text-palette-violet border-palette-violet/30 font-semibold">VOTRE PREFERENCE</Badge>
            {request.deadline && <DeadlineBadge deadline={request.deadline} />}
          </div>
          <p className="font-display text-sm font-semibold text-foreground">{request.message}</p>
          <p className="text-[10px] font-body text-muted-foreground/50 mt-0.5">
            Ce n'est pas un choix definitif. Vous pourrez affiner apres.
          </p>
          {request.revisionLimit != null && (
            <div className="mt-1.5">
              <RevisionCounter current={request.revisionCount ?? 0} limit={request.revisionLimit} compact />
            </div>
          )}
        </div>
      </div>

      <div className={cn("grid gap-3", options.length >= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
        {options.map((opt) => {
          const imgs = getOptionImages(opt);
          return (
            <button
              key={opt.id}
              onClick={() => setSelected(opt.id)}
              className={cn(
                "relative rounded-xl border-2 overflow-hidden text-left transition-all",
                selected === opt.id
                  ? "border-palette-violet ring-2 ring-palette-violet/20"
                  : "border-border hover:border-palette-violet/40"
              )}
            >
              {/* Recommended badge */}
              {opt.isRecommended && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-amber-500 text-white text-[9px] font-bold font-body uppercase tracking-wider rounded-full px-2 py-0.5 shadow-sm">
                  <Star size={9} /> Recommandé
                </div>
              )}

              {/* Multi-image carousel or single image */}
              {imgs.length > 0 && (
                <div onClick={(e) => e.stopPropagation()}>
                  <OptionImageGallery
                    images={imgs}
                    alt={opt.label}
                    variant="compact"
                  />
                </div>
              )}

              <div className="p-3">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="font-display text-sm font-semibold text-foreground">{opt.label}</p>
                  {selected === opt.id && (
                    <div className="w-5 h-5 rounded-full bg-palette-violet flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={12} className="text-white" />
                    </div>
                  )}
                </div>
                {opt.description && <p className="font-body text-xs text-muted-foreground">{opt.description}</p>}
                {opt.linkUrl && (
                  <a
                    href={opt.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 font-body text-[11px] text-primary mt-1.5 hover:text-primary/80 transition-colors"
                  >
                    Voir l'aperçu <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Full-page comparison link */}
      {projectId && taskId && options.length >= 2 && (
        <button
          onClick={() => navigate(`/client/${projectId}/feedback/${taskId}/${request.id}`)}
          className="w-full flex items-center justify-center gap-1.5 font-body text-xs text-primary/70 hover:text-primary transition-colors py-1"
        >
          <Maximize2 size={12} /> Comparer en plein écran
        </button>
      )}

      <Button
        className="w-full gap-2"
        disabled={!selected}
        onClick={() => {
          const opt = options.find((o) => o.id === selected);
          if (opt) onRespond(opt.label);
        }}
      >
        <Send size={14} />
        {selected ? `Confirmer : ${options.find((o) => o.id === selected)?.label}` : "Sélectionnez une option ci-dessus"}
      </Button>

      {/* Audit log */}
      {request.responseHistory && request.responseHistory.length > 0 && (
        <FeedbackAuditLog history={request.responseHistory} />
      )}

      {/* Stakeholder votes */}
      {request.stakeholderVotes && request.stakeholderVotes.length > 0 && (
        <StakeholderVoteSummary votes={request.stakeholderVotes} options={request.options} type="vote" />
      )}
    </div>
  );
}

// ── Text / File Request Card ──────────────────────────────────

function TextFileCard({ request, onRespond }: { request: FeedbackRequest; onRespond: (r: string) => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState("");
  const canSubmit = request.type === "file" ? !!(file.trim() || text.trim()) : !!text.trim();
  const hasGuided = request.guidedQuestions && request.guidedQuestions.length > 0;

  return (
    <div className="bg-card border-2 border-palette-amber/40 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-palette-amber/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={16} className="text-palette-amber" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className="text-[10px] bg-palette-amber/10 text-palette-amber border-palette-amber/30 font-semibold">
              {request.type === "file" ? "FICHIER DEMANDE" : "REPONSE ATTENDUE"}
            </Badge>
            {request.deadline && <DeadlineBadge deadline={request.deadline} />}
          </div>
          <p className="font-display text-sm font-semibold text-foreground">{request.message}</p>
        </div>
      </div>

      {/* Guided questions form */}
      {hasGuided ? (
        <GuidedQuestionsForm
          questions={request.guidedQuestions!}
          onSubmit={(answers) => {
            const formatted = Object.entries(answers)
              .map(([qId, val]) => {
                const q = request.guidedQuestions!.find((gq) => gq.id === qId);
                return q ? `${q.question}: ${val}` : val;
              })
              .join("\n");
            onRespond(formatted);
          }}
        />
      ) : request.type === "file" ? (
        <div className="space-y-3">
          <FileDropZone onFile={setFile} />
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="font-body text-xs text-muted-foreground">ou collez un lien</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="flex gap-2">
            <Input placeholder="Collez le lien du fichier (Google Drive, Dropbox, WeTransfer...)" value={text}
              onChange={(e) => setText(e.target.value)} className="text-xs h-9" />
            <Button size="sm" disabled={!canSubmit}
              onClick={() => onRespond(text || `[file: ${file}]`)}
              className="h-9 gap-1.5 shrink-0"><Send size={12} /> Envoyer</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input placeholder="Votre reponse (soyez le plus precis possible)..." value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) { onRespond(text); setText(""); } }}
            className="text-xs h-9" />
          <Button size="sm" disabled={!canSubmit}
            onClick={() => { onRespond(text); setText(""); }}
            className="h-9 gap-1.5 shrink-0"><Send size={12} /> Envoyer</Button>
        </div>
      )}

      {/* Audit log */}
      {request.responseHistory && request.responseHistory.length > 0 && (
        <FeedbackAuditLog history={request.responseHistory} />
      )}
    </div>
  );
}

// ── Blocking Request Router ───────────────────────────────────

function BlockingRequestCard({ request, taskTitle, taskId, stepNumber, projectId, onRespond, onToggleHighlight }: {
  request: FeedbackRequest; taskTitle: string; taskId: string; stepNumber: number; projectId?: string; onRespond: (r: string) => void; onToggleHighlight?: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 px-1">
        <p className="font-body text-xs text-muted-foreground flex-1">Étape {stepNumber} · {taskTitle}</p>
        {onToggleHighlight && (
          <button
            onClick={onToggleHighlight}
            className="p-1 rounded hover:bg-secondary/40 transition-colors"
            title={request.stakeholderHighlight ? "Retirer la priorite stakeholder" : "Marquer prioritaire pour stakeholders"}
          >
            <Star size={12} className={cn(
              request.stakeholderHighlight
                ? "text-amber-500 fill-amber-500"
                : "text-muted-foreground/40"
            )} />
          </button>
        )}</div>
      {request.type === "validation" ? (
        <ValidationCard request={request} onRespond={onRespond} />
      ) : request.type === "vote" ? (
        <VoteCard request={request} onRespond={onRespond} projectId={projectId} taskId={taskId} />
      ) : (
        <TextFileCard request={request} onRespond={onRespond} />
      )}
    </div>
  );
}

// ── Stakeholder Share Card ────────────────────────────────────

function StakeholderShareCard({ shareToken }: { shareToken: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/project/s/${shareToken}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  return (
    <div className="bg-violet-50/60 border border-violet-200/40 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Users size={14} className="text-violet-600 shrink-0" />
        <h3 className="font-display text-xs font-bold text-violet-800">Invitez vos parties prenantes</h3>
      </div>
      <p className="text-[11px] font-body text-violet-700/70 leading-relaxed">
        Partagez ce lien pour que votre equipe puisse consulter le parcours et ajouter des commentaires.
        Seul vous pouvez valider les decisions.
      </p>
      <button
        onClick={handleCopy}
        className={cn(
          "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-body font-medium transition-all",
          copied
            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
            : "bg-white text-violet-700 border border-violet-200/60 hover:border-violet-400 hover:bg-violet-50"
        )}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "Lien copie !" : "Copier le lien de partage"}
      </button>
      <p className="text-[9px] font-body text-violet-500/60 text-center">
        Vue en lecture seule. Les parties prenantes peuvent commenter mais pas valider.
      </p>
    </div>
  );
}

// ── Main Client Dashboard ─────────────────────────────────────

export default function ClientDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, respondToFeedbackRequest, toggleStakeholderHighlight, loading: projectsLoading } = useProjects();
  const { clients, loading: clientsLoading } = useClients();
  const { toast } = useToast();
  const project = getProject(id!);

  // ── Email gate ─────────────────────────────────────────────
  const requiredEmail = project?.clientId
    ? clients.find((c) => c.id === project.clientId)?.email?.toLowerCase() ?? null
    : null;

  // null = not yet evaluated (waiting for async data to load)
  const [emailAuthed, setEmailAuthed] = useState<boolean | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailInput.trim().toLowerCase() === requiredEmail) {
      setClientAuth(id!, emailInput.trim());
      setEmailAuthed(true);
    } else {
      setEmailError("Email non reconnu pour ce projet.");
    }
  }

  // Evaluate the gate once clients have finished loading
  useEffect(() => {
    if (clientsLoading) return; // wait — clients array may still be empty
    if (!requiredEmail) { setEmailAuthed(true); return; }
    setEmailAuthed(getClientAuth(id!) === requiredEmail);
  }, [requiredEmail, id, clientsLoading]);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [projectQuotes, setProjectQuotes] = useState<Quote[]>([]);
  const [welcomed, setWelcomed] = useState(() => {
    try { return localStorage.getItem(`kojima-client-welcomed-${id}`) === "1"; } catch { return false; }
  });
  const [lightbox, setLightbox] = useState<{ delivery: Delivery; index: number } | null>(null);
  const [cadrage, setCadrage] = useState<Cadrage | null>(null);
  const [ficheOpen, setFicheOpen] = useState(false);

  // Load cadrage data
  useEffect(() => {
    if (!project?.id) return;
    getCadrage(project.id).then(setCadrage).catch(() => {});
  }, [project?.id]);

  // Load project-specific quotes from DB
  useEffect(() => {
    if (!project?.id) return;
    listProjectQuotes(project.id)
      .then(setProjectQuotes)
      .catch(() => { /* silently ignore — no invoices shown */ });
  }, [project?.id]);

  // Unified timeline: use step statuses directly from project tasks
  const hasSteps = project ? project.tasks.length > 0 : false;

  const toggleStep = (taskId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  async function handleApproveQuote(quoteId: string) {
    try {
      await updateQuote(quoteId, { invoiceStatus: "validated" });
      setProjectQuotes((prev) => prev.map((q) => q.id === quoteId ? { ...q, invoiceStatus: "validated" } : q));
      toast({ title: "Devis accepté ✓", description: "Merci pour votre validation." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de valider le devis.", variant: "destructive" });
    }
  }

  const handleRespond = useCallback((taskId: string, requestId: string, response: string) => {
    respondToFeedbackRequest(id!, taskId, requestId, response);

    if (response === "approved" || response.startsWith("approved\n")) {
      toast({ title: "Approbation confirmee", description: "L'equipe peut maintenant passer a la suite." });
    } else if (response.startsWith("changes:")) {
      toast({ title: "Demande de modifications envoyee", description: "L'equipe va traiter vos retours sous 48h." });
    } else {
      toast({ title: "Reponse enregistree", description: "Merci pour votre retour !" });
    }
  }, [id, respondToFeedbackRequest, toast]);

  // Show spinner while projects/clients are loading OR while auth hasn't been evaluated yet
  if (projectsLoading || clientsLoading || emailAuthed === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-muted-foreground" />
          </div>
          <p className="font-display text-xl text-foreground font-bold mb-2">Projet introuvable</p>
          <p className="font-body text-sm text-muted-foreground">Ce lien est peut-être invalide ou le projet a été supprimé.</p>
        </div>
      </div>
    );
  }

  // Email gate screen
  if (!emailAuthed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
              <User size={22} className="text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {project.title}
            </h1>
            <p className="font-body text-sm text-muted-foreground mt-1">Entrez votre email pour accéder à ce projet</p>
          </div>
          <form
            onSubmit={handleEmailSubmit}
            className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4"
          >
            <Input
              type="email"
              placeholder="votre@email.com"
              value={emailInput}
              onChange={(e) => { setEmailInput(e.target.value); setEmailError(""); }}
              className="font-body"
              autoFocus
            />
            {emailError && (
              <p className="font-body text-sm text-destructive">{emailError}</p>
            )}
            <Button type="submit" className="w-full font-body">
              Continuer
            </Button>
            <a
              href="/client/login"
              className="block text-center text-xs text-muted-foreground hover:text-primary transition-colors mt-2"
            >
              Accéder à tous vos projets →
            </a>
          </form>
        </div>
      </div>
    );
  }

  function dismissWelcome() {
    setWelcomed(true);
    try { localStorage.setItem(`kojima-client-welcomed-${id}`, "1"); } catch {}
  }

  const sorted = [...project.tasks].sort((a, b) => a.order - b.order);

  // ── Welcome onboarding (first visit) ──
  if (!welcomed) {
    return <WelcomeOnboarding
      clientName={project.client}
      projectTitle={project.title}
      onDismiss={dismissWelcome}
    />;
  }

  // ── Per-task completion score (0–1): completed flag OR subtask ratio ──
  const completedTaskScore = sorted.reduce((sum, t) => {
    if (t.completed) return sum + 1;
    const subs = t.subtasks || [];
    if (subs.length === 0) return sum; // no subtasks, not marked done → 0
    return sum + (subs.filter((s) => s.completed).length / subs.length);
  }, 0);
  const overallProgress = sorted.length > 0
    ? Math.round((completedTaskScore / sorted.length) * 100)
    : 0;

  const blockingRequests = sorted.flatMap((task, i) =>
    (task.feedbackRequests || [])
      .filter((r) => !r.resolved)
      .map((r) => ({ request: r, task, stepNumber: i + 1 }))
  );

  const statusBadge = STATUS_BADGE[project.status];

  const allDeliveries   = project.deliveries ?? [];
  const finalDeliveries = allDeliveries.filter((d) => !d.taskId);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Image Lightbox ── */}
      {lightbox && (
        <ImageLightbox
          delivery={lightbox.delivery}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* ── Top bar + progress strip ── */}
      <div className="bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <span className="font-display font-bold text-lg tracking-tight">
            Kojima<span className="opacity-50">.</span>Solutions
          </span>
          <span className="font-body text-xs text-primary-foreground/50 uppercase tracking-widest">Espace client</span>
        </div>
        <div className="h-1 bg-primary-foreground/10">
          <div className="h-full bg-primary-foreground/60 transition-all duration-700" style={{ width: `${overallProgress}%` }} />
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>

        {/* ── Ball-in-court banner (always visible) ── */}
        {(() => {
          const totalPending = blockingRequests.length;
          const isClientTurn = totalPending > 0;

          // Find the most urgent blocking request for display
          const urgentRequest = blockingRequests.length > 0
            ? [...blockingRequests].sort((a, b) => {
                const dA = a.request.deadline;
                const dB = b.request.deadline;
                if (!dA && !dB) return 0;
                if (!dA) return 1;
                if (!dB) return -1;
                return new Date(dA).getTime() - new Date(dB).getTime();
              })[0]
            : null;

          const deadlineDays = urgentRequest?.request.deadline
            ? Math.ceil((new Date(urgentRequest.request.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;
          const isOverdue = deadlineDays !== null && deadlineDays < 0;
          const isUrgent = deadlineDays !== null && deadlineDays <= 3 && deadlineDays >= 0;

          if (isClientTurn) {
            return (
              <section>
                <div className={cn(
                  "rounded-xl px-4 py-4 border",
                  isOverdue ? "bg-red-50 border-red-200/50" :
                  isUrgent ? "bg-amber-50 border-amber-200/50" :
                  "bg-blue-50 border-blue-200/50",
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                      isOverdue ? "bg-red-100" : isUrgent ? "bg-amber-100" : "bg-blue-100",
                    )}>
                      <AlertTriangle size={18} className={cn(
                        isOverdue ? "text-red-600" : isUrgent ? "text-amber-600" : "text-blue-600",
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-display font-bold", isOverdue ? "text-red-800" : isUrgent ? "text-amber-800" : "text-blue-800")}>
                        Votre tour : {totalPending} {totalPending > 1 ? "actions en attente" : "action en attente"}
                      </p>
                      <p className="text-xs font-body text-muted-foreground truncate mt-0.5">
                        {urgentRequest ? urgentRequest.request.message : ""}
                      </p>
                      {isOverdue && (
                        <p className="text-[10px] font-body text-red-600/80 mt-0.5">
                          Votre retour est en retard — le projet est en pause jusqu'a votre reponse.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            );
          }

          // Agency's turn (green)
          const currentOpen = sorted.find((t) => t.status === "open" &&
            (!t.feedbackRequests || t.feedbackRequests.every((r) => r.resolved)));
          const nextLockedStep = sorted.find((t) => t.status === "locked");
          let agencyMsg = "L'equipe avance sur les prochaines etapes.";
          if (currentOpen) agencyMsg = `Nous travaillons sur : ${currentOpen.title}`;
          else if (nextLockedStep) agencyMsg = `Prochaine etape : ${nextLockedStep.title}`;

          return (
            <section>
              <div className="rounded-xl px-4 py-4 border bg-emerald-50 border-emerald-200/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-emerald-100">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-bold text-emerald-800">
                      Notre tour : nous travaillons sur votre projet
                    </p>
                    <p className="text-xs font-body text-emerald-700/60 mt-0.5">
                      {agencyMsg}
                    </p>
                    <p className="text-[10px] font-body text-emerald-600/40 mt-0.5">
                      Nous vous contacterons des que votre avis sera necessaire.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          );
        })()}

        {/* ── Section B: Project Overview ── */}
        <section className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">{project.title}</h1>
              {project.client && (
                <div className="flex items-center gap-1.5 font-body text-sm text-muted-foreground mb-2">
                  <User size={13} /> <span>{project.client}</span>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn("text-xs gap-1", statusBadge.className)}>{statusBadge.label}</Badge>
                {(project.startDate || project.endDate) && (
                  <span className="font-body text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays size={11} />
                    {project.startDate && new Date(project.startDate).toLocaleDateString()}
                    {project.startDate && project.endDate && " → "}
                    {project.endDate && new Date(project.endDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            {sorted.length > 0 && (
              <div className="text-right shrink-0">
                <p className="font-display text-4xl font-bold text-primary leading-none">
                  {overallProgress}<span className="text-lg text-muted-foreground">%</span>
                </p>
                <p className="font-body text-xs text-muted-foreground mt-1">terminé</p>
              </div>
            )}
          </div>

          {/* Project description */}
          {project.description && (
            <div className="mb-4">
              <RichText text={project.description} className="font-body text-sm text-foreground/70" />
            </div>
          )}

          {/* Overall progress bar */}
          {sorted.length > 0 && (
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-body text-xs text-muted-foreground">Avancement global</span>
                <span className="font-body text-xs text-muted-foreground">
                  {Math.round(completedTaskScore)}/{sorted.length} étapes
                </span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}
        </section>

        {/* ── Fiche projet (description + cadrage) ── */}
        {(project.description || cadrage) && (
          <section>
            <button
              onClick={() => setFicheOpen(!ficheOpen)}
              className="w-full flex items-center justify-between py-2 group"
            >
              <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <FileText size={12} />
                Fiche projet
              </h2>
              <ChevronDown size={14} className={cn(
                "text-muted-foreground/40 transition-transform",
                ficheOpen && "rotate-180"
              )} />
            </button>
            {ficheOpen && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-4 mt-1">
                {project.description && (
                  <div>
                    <p className="font-display text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Description</p>
                    <RichText text={project.description} className="text-foreground/70 text-xs" />
                  </div>
                )}
                {cadrage?.objectives && (
                  <div>
                    <p className="font-display text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Objectifs</p>
                    <RichText text={cadrage.objectives} className="text-foreground/70 text-xs" />
                  </div>
                )}
                {cadrage?.inScope && (
                  <div>
                    <p className="font-display text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Perimetre</p>
                    <RichText text={cadrage.inScope} className="text-foreground/70 text-xs" />
                  </div>
                )}
                {cadrage?.outScope && (
                  <div>
                    <p className="font-display text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Hors perimetre</p>
                    <RichText text={cadrage.outScope} className="text-foreground/70 text-xs" />
                  </div>
                )}
                {cadrage?.deliverables && (
                  <div>
                    <p className="font-display text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Livrables</p>
                    <RichText text={cadrage.deliverables} className="text-foreground/70 text-xs" />
                  </div>
                )}
                {cadrage?.constraints && (
                  <div>
                    <p className="font-display text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Contraintes</p>
                    <RichText text={cadrage.constraints} className="text-foreground/70 text-xs" />
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Unified Action Cards (pending feedback requests) ── */}
        {(() => {
          if (blockingRequests.length === 0) {
            return (
              <section>
                <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                  Vos actions
                </h2>
                <div className="bg-emerald-50/50 border border-emerald-200/30 rounded-xl p-5 text-center space-y-2">
                  <CheckCircle2 size={24} className="text-emerald-500 mx-auto" />
                  <p className="font-display text-sm font-semibold text-emerald-800">
                    Vous etes a jour !
                  </p>
                  <p className="font-body text-xs text-emerald-600/70">
                    Aucune action en attente. Nous vous notifierons des que votre retour sera necessaire.
                  </p>
                </div>
              </section>
            );
          }

          return (
            <section>
              <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                Vos actions
              </h2>
              <div className="space-y-3">
                {/* Feedback request action cards */}
                {blockingRequests.map(({ request, task, stepNumber }) => {
                  const typeLabel = request.type === "validation" ? "APPROBATION"
                    : request.type === "vote" ? "CHOIX"
                    : request.type === "file" ? "FICHIER" : "RETOUR";
                  const typeColor = request.type === "validation" ? "text-primary bg-primary/10 border-primary/30"
                    : request.type === "vote" ? "text-palette-violet bg-palette-violet/10 border-palette-violet/30"
                    : "text-palette-amber bg-palette-amber/10 border-palette-amber/30";

                  return (
                    <div key={request.id} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                          request.type === "validation" ? "bg-primary/10" :
                          request.type === "vote" ? "bg-palette-violet/10" : "bg-palette-amber/10",
                        )}>
                          {request.type === "validation" ? <CheckCircle2 size={16} className="text-primary" /> :
                           request.type === "vote" ? <Vote size={16} className="text-palette-violet" /> :
                           request.type === "file" ? <Upload size={16} className="text-palette-amber" /> :
                           <MessageSquare size={16} className="text-palette-amber" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant="outline" className={cn("text-[9px] font-semibold", typeColor)}>{typeLabel}</Badge>
                            <span className="text-[10px] font-body text-muted-foreground">Étape {stepNumber} · {task.title}</span>
                          </div>
                          <p className="font-display text-sm font-semibold text-foreground">{request.message}</p>
                          {/* Deadline impact context */}
                          {request.deadline && (() => {
                            const days = Math.ceil((new Date(request.deadline).getTime() - Date.now()) / 86400000);
                            if (days < 0) return (
                              <p className="text-[10px] font-body text-red-600 mt-1">
                                En retard — le projet est en pause en attendant votre retour.
                              </p>
                            );
                            if (days <= 3) return (
                              <p className="text-[10px] font-body text-amber-600 mt-1">
                                Echeance {days === 0 ? "aujourd'hui" : `dans ${days}j`} — merci de repondre rapidement pour eviter un retard.
                              </p>
                            );
                            return null;
                          })()}
                        </div>
                        <button
                          onClick={() => {
                            if (request.type === "vote" && (request.options?.length ?? 0) >= 2) {
                              navigate(`/client/${project.id}/feedback/${task.id}/${request.id}`);
                            } else {
                              setExpandedSteps((prev) => { const next = new Set(prev); next.add(task.id); return next; });
                              setTimeout(() => document.getElementById(`step-${task.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                            }
                          }}
                          className="shrink-0 text-[11px] font-body font-semibold text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 hover:bg-primary/20 transition-colors flex items-center gap-1"
                        >
                          {request.type === "vote" ? "Comparer" : "Répondre"} <ArrowRight size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* ── Stakeholder share card ── */}
        {project.shareToken && (
          <StakeholderShareCard shareToken={project.shareToken} />
        )}

        {/* ── Task Timeline ── */}
        {sorted.length > 0 && (
          <section>
            <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Avancement du projet
            </h2>

            <div className="relative space-y-3">
              {/* Vertical connector line */}
              {sorted.length > 1 && (
                <div className="absolute left-[31px] top-10 bottom-10 w-0.5 bg-border/60 rounded-full pointer-events-none z-0" />
              )}
              {sorted.map((task, i) => {
                const subtasks         = task.subtasks || [];
                const completedCount   = subtasks.filter((s) => s.completed).length;
                const progress         = task.completed ? 100 : (subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0);
                const isExpanded       = expandedSteps.has(task.id);
                const resolvedRequests = (task.feedbackRequests || []).filter((r) => r.resolved);
                const pendingFeedback  = (task.feedbackRequests || []).filter((r) => !r.resolved);
                const pendingCount     = pendingFeedback.length;
                const isComplete       = task.completed || (subtasks.length > 0 && completedCount === subtasks.length);
                const isBlocking       = pendingCount > 0;

                // Always show inline feedback in unified timeline
                const showInlineFeedback = true;

                const isLocked = task.status === "locked";

                return (
                  <div key={task.id} id={`step-${task.id}`} className={cn(
                    "relative z-10 bg-card border rounded-xl overflow-hidden ring-2 transition-shadow",
                    isLocked && "opacity-60",
                    isBlocking && showInlineFeedback ? "ring-palette-amber/30 border-palette-amber/20" : "ring-transparent border-border"
                  )}>
                    <button
                      onClick={() => !isLocked && toggleStep(task.id)}
                      className={cn(
                        "w-full text-left p-4 flex items-center gap-3 transition-colors",
                        isLocked ? "cursor-default" : "hover:bg-secondary/20"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                        isLocked ? "bg-gray-300 text-gray-500" :
                        isComplete ? "bg-emerald-500 text-white" :
                        cn(COLOR_MAP[task.color || "primary"], "text-white")
                      )}>
                        {isComplete ? <CheckCircle2 size={14} /> : String(i + 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-display text-sm font-semibold text-foreground truncate">{task.title}</h3>
                          <div className="flex items-center gap-2 shrink-0">
                            {isBlocking && showInlineFeedback && (
                              <Badge variant="outline" className="text-[10px] bg-palette-amber/10 text-palette-amber border-palette-amber/30">Action requise</Badge>
                            )}
                            {isComplete && !(isBlocking && showInlineFeedback) && (
                              <Badge variant="outline" className="text-[10px] bg-palette-sage/10 text-palette-sage border-palette-sage/30">Terminé</Badge>
                            )}
                            <span className="font-body text-xs text-muted-foreground hidden sm:inline">{task.dateLabel}</span>
                            {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                          </div>
                        </div>
                        {/* Per-step progress bar */}
                        {(subtasks.length > 0 || task.completed) && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <Progress value={progress} className="h-1.5 flex-1" />
                            <span className="font-body text-[10px] text-muted-foreground whitespace-nowrap">
                              {task.completed ? "Fait" : `${completedCount}/${subtasks.length}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border">
                        {task.description && (
                          <div className="px-4 pt-3 pb-2">
                            <RichText text={task.description} className="text-foreground/70 text-xs" />
                          </div>
                        )}
                        {subtasks.length > 0 && (
                          <div className="px-4 py-3 space-y-2 border-t border-border/50">
                            <p className="font-display text-xs font-semibold text-muted-foreground">Livrables</p>
                            {subtasks.map((st) => (
                              <div key={st.id} className="flex items-center gap-2">
                                {st.completed
                                  ? <CheckCircle2 size={14} className="text-palette-sage flex-shrink-0" />
                                  : <Circle size={14} className="text-muted-foreground flex-shrink-0" />}
                                <span className={cn("font-body text-xs", st.completed ? "text-foreground/50 line-through" : "text-foreground")}>{st.title}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Step deliveries for this task */}
                        {(() => {
                          const stepDeliveries = allDeliveries.filter((d) => d.taskId === task.id);
                          return stepDeliveries.length > 0 ? (
                            <div className="px-4 py-3 space-y-2 border-t border-border/50">
                              <p className="font-display text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                <Package size={11} className="text-palette-sage" /> Livrables de cette étape
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {stepDeliveries.map((d) => <DeliveryCard key={d.id} d={d} onLightbox={(i) => setLightbox({ delivery: d, index: i })} />)}
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* Pending feedback requests (only shown inline when no funnel) */}
                        {showInlineFeedback && pendingFeedback.length > 0 && (
                          <div className="px-4 py-3 space-y-3 border-t border-palette-amber/20 bg-palette-amber/5">
                            <p className="font-display text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <AlertTriangle size={12} className="text-palette-amber" /> En attente de votre retour
                            </p>
                            {pendingFeedback.map((req) => (
                              <BlockingRequestCard
                                key={req.id}
                                request={req}
                                taskTitle={task.title}
                                taskId={task.id}
                                stepNumber={i + 1}
                                projectId={project.id}
                                onRespond={(r) => handleRespond(task.id, req.id, r)}
                                onToggleHighlight={() => toggleStakeholderHighlight(project.id, task.id, req.id)}
                              />
                            ))}
                          </div>
                        )}

                        {/* When funnel is active but there are pending feedback items, show a link to the action section */}
                        {!showInlineFeedback && pendingFeedback.length > 0 && (
                          <div className="px-4 py-3 border-t border-border/50">
                            <button
                              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                              className="font-body text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                            >
                              <AlertTriangle size={11} className="text-palette-amber" />
                              {pendingCount} action{pendingCount > 1 ? "s" : ""} en attente
                              <ArrowRight size={10} />
                            </button>
                          </div>
                        )}

                        {resolvedRequests.length > 0 && (
                          <div className="px-4 py-3 border-t border-border/50 space-y-1.5">
                            <p className="font-display text-xs font-semibold text-muted-foreground">Vos réponses</p>
                            {resolvedRequests.map((req) => (
                              <div key={req.id} className="flex items-start gap-2 text-xs font-body">
                                <CheckCircle2 size={13} className="text-palette-sage mt-0.5 shrink-0" />
                                <span className="text-foreground/70 flex-1">
                                  {req.message}: <em className="text-foreground">{req.response}</em>
                                  {req.respondedAt && (
                                    <span className="ml-2 text-[10px] text-muted-foreground/50 not-italic">
                                      {new Date(req.respondedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Final Deliverables ── */}
        {finalDeliveries.length > 0 && (
          <section>
            <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
              <Package size={14} /> Livrables finaux
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {finalDeliveries.map((d: Delivery) => <DeliveryCard key={d.id} d={d} onLightbox={(i) => setLightbox({ delivery: d, index: i })} isFinal />)}
            </div>
          </section>
        )}

        {/* ── Invoices / Devis ── */}
        {projectQuotes.length > 0 && (
          <section>
            <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Devis / Factures
            </h2>
            {projectQuotes.some((q) => q.invoiceStatus === "to-validate") && (
              <div className="bg-palette-amber/10 border border-palette-amber/30 rounded-xl px-4 py-3 flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-palette-amber shrink-0" />
                <p className="font-body text-xs text-palette-amber font-medium">
                  Vous avez {projectQuotes.filter((q) => q.invoiceStatus === "to-validate").length} devis en attente de validation.
                </p>
              </div>
            )}
            <div className="space-y-2">
              {projectQuotes.map((q) => (
                <div key={q.id} className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  {/* Info row */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm font-semibold text-foreground truncate">
                        {q.quoteNumber || `Document #${q.id.slice(0, 8)}`}
                      </p>
                      <p className="font-body text-xs text-muted-foreground">
                        {q.createdAt ? new Date(q.createdAt).toLocaleDateString("fr-CH") : ""}
                        {q.clientName ? ` · ${q.clientName}` : ""}
                      </p>
                    </div>
                    {/* Price on mobile inline, hidden on desktop */}
                    <div className="text-right shrink-0 sm:hidden space-y-1">
                      <p className="font-display text-sm font-semibold text-foreground">
                        CHF {new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(totalQuote(q)).replace(/(?<=\d)[\s\u00A0\u202F](?=\d)/g, "'")}
                      </p>
                      {q.invoiceStatus && INVOICE_STATUS[q.invoiceStatus] && (
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${INVOICE_STATUS[q.invoiceStatus].className}`}>
                          {INVOICE_STATUS[q.invoiceStatus].label}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Price + actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-12 sm:pl-0">
                    {/* Price on desktop */}
                    <div className="text-right shrink-0 hidden sm:block space-y-1">
                      <p className="font-display text-sm font-semibold text-foreground">
                        CHF {new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(totalQuote(q)).replace(/(?<=\d)[\s\u00A0\u202F](?=\d)/g, "'")}
                      </p>
                      {q.invoiceStatus && INVOICE_STATUS[q.invoiceStatus] && (
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${INVOICE_STATUS[q.invoiceStatus].className}`}>
                          {INVOICE_STATUS[q.invoiceStatus].label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1.5"
                        onClick={() => printViaIframe(`/quotes/${q.id}/print`)}
                      >
                        <FileDown size={12} />
                        <span className="hidden sm:inline">Télécharger</span>
                        <span className="sm:hidden">PDF</span>
                      </Button>
                      {q.invoiceStatus === "to-validate" && (
                        <Button
                          size="sm"
                          className="text-xs gap-1.5 bg-palette-sage text-white hover:bg-palette-sage/90"
                          onClick={() => handleApproveQuote(q.id)}
                        >
                          <CheckCircle2 size={12} />
                          <span className="hidden sm:inline">Accepter le devis</span>
                          <span className="sm:hidden">Accepter</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Footer ── */}
        <footer className="text-center py-6 border-t border-border space-y-2">
          <p className="font-body text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-foreground">Kojima.Solutions</span>
          </p>
          <a
            href="mailto:massaki@kojima-solutions.ch?subject=Question - Portail client"
            className="inline-block font-body text-[11px] text-primary/70 hover:text-primary transition-colors"
          >
            Besoin d'aide ? massaki@kojima-solutions.ch
          </a>
        </footer>
      </main>
    </div>
  );
}
