import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, ThumbsUp, ThumbsDown, Send, Vote,
  Upload, CalendarDays, Star, ExternalLink, Maximize2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FeedbackRequest, VoteOption, GuidedQuestion } from "@/types/timeline";
import { OptionImageGallery } from "@/components/funnel/OptionImageGallery";
import { RevisionCounter } from "@/components/feedback/RevisionCounter";
import { FeedbackAuditLog } from "@/components/feedback/FeedbackAuditLog";
import { StakeholderVoteSummary } from "@/components/feedback/StakeholderVoteSummary";
import { cn } from "@/lib/utils";

// ── File Drop Zone ────────────────────────────────────────────

export function FileDropZone({ onFile }: { onFile: (name: string) => void }) {
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

export function DeadlineBadge({ deadline }: { deadline: string }) {
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

export function GuidedQuestionsForm({ questions, onSubmit }: {
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

export function ValidationCard({ request, onRespond }: { request: FeedbackRequest; onRespond: (r: string) => void }) {
  const [choice, setChoice]           = useState<"approved" | "changes" | null>(null);
  const [changesNote, setChangesNote] = useState("");

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

export function VoteCard({ request, onRespond, projectId, taskId }: {
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

export function TextFileCard({ request, onRespond }: { request: FeedbackRequest; onRespond: (r: string) => void }) {
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

export function BlockingRequestCard({ request, taskTitle, taskId, stepNumber, projectId, onRespond, onToggleHighlight }: {
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
