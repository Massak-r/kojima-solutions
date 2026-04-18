import { useEffect, useMemo, useState } from "react";
import { Sparkles, Copy, Download, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { UnifiedObjective } from "@/api/objectiveSource";
import type { SubtaskItem, EffortSize } from "@/api/todoSubtasks";

export interface ParsedSubtask {
  text: string;
  effortSize?: EffortSize;
  estimatedMinutes?: number;
}

interface AIBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objective: UnifiedObjective;
  subtasks: SubtaskItem[];
  linkedProjectName?: string | null;
  linkedClientName?: string | null;
  onImport: (items: ParsedSubtask[]) => Promise<void> | void;
}

function buildPrompt(
  objective: UnifiedObjective,
  subtasks: SubtaskItem[],
  linkedProjectName?: string | null,
  linkedClientName?: string | null,
): string {
  const lines: string[] = [];
  lines.push("Tu m'aides à découper un objectif en étapes actionnables, dans l'esprit d'un sprint focalisé (\"une action à la fois\").");
  lines.push("");
  lines.push("# Objectif");
  lines.push(`Titre : ${objective.text}`);
  if (objective.description) lines.push(`Description : ${objective.description}`);
  if (objective.dueDate) lines.push(`Échéance : ${objective.dueDate}`);
  if (objective.priority) lines.push(`Priorité : ${objective.priority}`);
  if (objective.status) lines.push(`Statut : ${objective.status}`);
  if (linkedProjectName) lines.push(`Projet lié : ${linkedProjectName}`);
  if (linkedClientName) lines.push(`Client lié : ${linkedClientName}`);
  lines.push("");

  const smartParts: string[] = [];
  if (objective.smartSpecific)   smartParts.push(`- Spécifique : ${objective.smartSpecific}`);
  if (objective.smartMeasurable) smartParts.push(`- Mesurable : ${objective.smartMeasurable}`);
  if (objective.smartAchievable) smartParts.push(`- Atteignable : ${objective.smartAchievable}`);
  if (objective.smartRelevant)   smartParts.push(`- Pertinent : ${objective.smartRelevant}`);
  if (smartParts.length > 0) {
    lines.push("# Critères SMART");
    lines.push(...smartParts);
    lines.push("");
  }

  if (objective.definitionOfDone) {
    lines.push("# Definition of Done");
    lines.push(objective.definitionOfDone);
    lines.push("");
  }

  const pending = subtasks.filter(s => !s.completed);
  if (pending.length > 0) {
    lines.push("# Étapes déjà prévues (à NE PAS reproposer)");
    for (const s of pending) lines.push(`- ${s.text}`);
    lines.push("");
  }

  lines.push("# Ce que je te demande");
  lines.push("Propose 3 à 7 étapes concrètes, actionnables, dans l'ordre logique d'exécution.");
  lines.push("Réponds en français, format liste à puces (un tiret par étape).");
  lines.push("Pour chaque étape, ajoute si possible :");
  lines.push("- une étiquette d'effort entre crochets : [Rapide] (≤30 min), [Moyen] (1-2h), [Complexe] (½ journée+)");
  lines.push("- une estimation entre parenthèses : (15 min), (90 min), etc.");
  lines.push("");
  lines.push("Exemple de format :");
  lines.push("- Définir le persona principal [Rapide] (20 min)");
  lines.push("- Brouillon de la landing [Moyen] (90 min)");
  lines.push("- Revue par le client et itération [Complexe] (4h)");
  return lines.join("\n");
}

const EFFORT_MAP: Record<string, EffortSize> = {
  rapide:   "rapide",
  moyen:    "moyen",
  complexe: "complexe",
};

function parseResponse(raw: string): ParsedSubtask[] {
  const lines = raw.split(/\r?\n/);
  const out: ParsedSubtask[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    // Skip obvious headers
    if (line.startsWith("#")) continue;
    if (/^\*\*.+\*\*\s*:?\s*$/.test(line)) continue;
    // Match a bullet line
    const m = line.match(/^(?:[-*•+]|\d+[.)])\s+(.*)$/);
    if (!m) continue;
    let text = m[1].trim();
    if (!text) continue;

    // Extract optional effort tag [Rapide|Moyen|Complexe]
    let effortSize: EffortSize | undefined;
    text = text.replace(/\[(rapide|moyen|complexe)\]/i, (_full, tag: string) => {
      effortSize = EFFORT_MAP[tag.toLowerCase()];
      return "";
    });

    // Extract optional estimate (N min) or (N h) or (Nh) or (N min)
    let estimatedMinutes: number | undefined;
    text = text.replace(/\((\d+(?:[.,]\d+)?)\s*(min|m|h|heure[s]?)\b\)/i, (_full, num: string, unit: string) => {
      const n = parseFloat(num.replace(",", "."));
      if (!isNaN(n)) {
        const u = unit.toLowerCase();
        estimatedMinutes = u.startsWith("h") ? Math.round(n * 60) : Math.round(n);
      }
      return "";
    });

    // Strip trailing markdown emphasis and whitespace
    text = text.replace(/^\*\*(.+?)\*\*[:.]?$/, "$1").replace(/\s{2,}/g, " ").trim();
    text = text.replace(/^[-:.\s]+|[-:.\s]+$/g, "").trim();
    if (!text) continue;

    out.push({ text, effortSize, estimatedMinutes });
  }
  return out;
}

export function AIBreakdownDialog({
  open, onOpenChange, objective, subtasks, linkedProjectName, linkedClientName, onImport,
}: AIBreakdownDialogProps) {
  const initialPrompt = useMemo(
    () => buildPrompt(objective, subtasks, linkedProjectName, linkedClientName),
    [objective, subtasks, linkedProjectName, linkedClientName],
  );

  const [prompt, setPrompt]     = useState(initialPrompt);
  const [response, setResponse] = useState("");
  const [copied, setCopied]     = useState(false);
  const [importing, setImporting] = useState(false);

  // Reset state when reopening or when the source data changes
  useEffect(() => {
    if (open) {
      setPrompt(initialPrompt);
      setResponse("");
      setCopied(false);
    }
  }, [open, initialPrompt]);

  const parsed = useMemo(() => parseResponse(response), [response]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  async function handleImport() {
    if (parsed.length === 0 || importing) return;
    setImporting(true);
    try {
      await onImport(parsed);
      onOpenChange(false);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            Décomposer avec l'IA
          </DialogTitle>
          <DialogDescription>
            Copiez le prompt dans Claude (ou votre IA préférée), puis collez la réponse pour importer les étapes proposées.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto -mx-6 px-6">
          {/* Step 1 — Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <label className="text-xs font-display font-bold uppercase tracking-wider text-foreground/70">
                1 · Prompt à copier
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="h-7 gap-1.5 rounded-full text-xs"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copié" : "Copier"}
              </Button>
            </div>
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={8}
              className="font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Step 2 — Response */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-display font-bold uppercase tracking-wider text-foreground/70">
                2 · Coller la réponse
              </label>
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                {parsed.length} étape{parsed.length !== 1 ? "s" : ""} détectée{parsed.length !== 1 ? "s" : ""}
              </span>
            </div>
            <Textarea
              value={response}
              onChange={e => setResponse(e.target.value)}
              rows={8}
              placeholder="- Première étape [Rapide] (20 min)&#10;- Deuxième étape [Moyen] (1h)&#10;…"
              className="font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Preview */}
          {parsed.length > 0 && (
            <div>
              <div className="text-xs font-display font-bold uppercase tracking-wider text-foreground/70 mb-1.5">
                Aperçu
              </div>
              <ul className="space-y-1 rounded-xl border border-border/40 bg-card/40 p-3">
                {parsed.map((p, i) => (
                  <li key={i} className="text-sm font-body flex items-start gap-2">
                    <span className="text-muted-foreground/50 tabular-nums shrink-0 mt-0.5">{i + 1}.</span>
                    <span className="flex-1">{p.text}</span>
                    {p.effortSize && (
                      <span className="text-[10px] font-body font-bold uppercase px-1.5 py-0.5 rounded-full bg-muted/60 text-foreground/70 shrink-0">
                        {p.effortSize}
                      </span>
                    )}
                    {p.estimatedMinutes !== undefined && (
                      <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
                        {p.estimatedMinutes}min
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="text-[10px] font-body text-muted-foreground/70 italic px-1 pt-1">
          Astuce&nbsp;: avec Claude Code + le MCP <code className="font-mono">kojima</code> configuré, demandez directement dans une conversation — l'IA crée les étapes sans cette boîte de dialogue.
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing}>
            Fermer
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsed.length === 0 || importing}
            className="gap-1.5"
          >
            {importing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Importer {parsed.length > 0 ? `${parsed.length} étape${parsed.length > 1 ? "s" : ""}` : "les étapes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
