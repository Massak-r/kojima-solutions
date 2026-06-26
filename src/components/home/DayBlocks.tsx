import { useState } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";
import { toISODate } from "@/lib/weekDates";
import { useTimeBlocks, useCreateTimeBlock, useDeleteTimeBlock } from "@/hooks/useTimeBlocks";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { haptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function hhmmToMin(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function durationLabel(start: number, end: number): string {
  const mins = end - start;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h && m ? `${h}h${String(m).padStart(2, "0")}` : h ? `${h}h` : `${m}min`;
}

/** "Programme du jour" — the day's manual time-blocks (in-app schedule store).
 *  Lives on the Aujourd'hui surface; DB-backed so it syncs across devices. */
export function DayBlocks() {
  const day = toISODate(new Date());
  const { data: blocks = [], isLoading } = useTimeBlocks(day);
  const createBlock = useCreateTimeBlock(day);
  const deleteBlock = useDeleteTimeBlock(day);

  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [title, setTitle] = useState("");

  const startMin = hhmmToMin(start);
  const endMin = hhmmToMin(end);
  const valid = endMin > startMin;

  function submit() {
    if (!valid) return;
    createBlock.mutate(
      { day, startMin, endMin, title: title.trim() },
      { onSuccess: () => { haptic("success"); setOpen(false); setTitle(""); } },
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-primary" />
          <h2 className="text-eyebrow">Programme du jour</h2>
          {blocks.length > 0 && (
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground">· {blocks.length}</span>
          )}
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-[11px] font-body font-medium rounded-full px-2.5 py-1 border border-border hover:bg-secondary transition-colors"
        >
          <Plus size={12} /> Ajouter un bloc
        </button>
      </header>

      <div className="p-4 sm:p-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground/70 font-body py-2">Chargement…</p>
        ) : blocks.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm font-body text-muted-foreground mb-3 max-w-xs mx-auto">
              Bloque des moments pour tes tâches — la journée se planifie d'elle-même.
            </p>
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-body font-semibold rounded-full px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus size={14} /> Planifier un bloc
            </button>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-stretch gap-3 group">
                <div className="flex flex-col items-end pt-0.5 w-12 shrink-0">
                  <span className="text-[11px] font-mono tabular-nums text-foreground/80">{minToHHMM(b.startMin)}</span>
                  <span className="text-[10px] font-mono tabular-nums text-muted-foreground/50">{minToHHMM(b.endMin)}</span>
                </div>
                <div className="w-1 rounded-full bg-primary/60 shrink-0" />
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-2">
                  <span className="text-sm font-body text-foreground truncate">{b.title || "Bloc"}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60">{durationLabel(b.startMin, b.endMin)}</span>
                    <button
                      onClick={() => { haptic("tap"); deleteBlock.mutate(b.id); }}
                      aria-label="Supprimer le bloc"
                      className="p-1 rounded-md text-muted-foreground/40 hover:text-red-600 hover:bg-red-50 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent className="sm:max-w-sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Nouveau bloc</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="tb-start" className="text-xs">Début</Label>
                <Input id="tb-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="tb-end" className="text-xs">Fin</Label>
                <Input id="tb-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tb-title" className="text-xs">Intitulé</Label>
              <Input
                id="tb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Acompte WD2026"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              />
            </div>
            {!valid && <p className="text-[11px] text-destructive font-body">La fin doit être après le début.</p>}
          </div>
          <ResponsiveDialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={!valid || createBlock.isPending}>Ajouter</Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </section>
  );
}
