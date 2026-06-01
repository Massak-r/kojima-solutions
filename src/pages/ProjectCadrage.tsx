import { useParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { ProjectStepNav } from "@/components/ProjectStepNav";
import { getCadrage, saveCadrage, type Cadrage } from "@/api/cadrage";
import { getIntakeByProject } from "@/api/funnels";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardCheck,
  Target,
  CheckSquare,
  XSquare,
  Package,
  CalendarClock,
  AlertTriangle,
  Wallet,
  Loader2,
  Save,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Blocks } from "lucide-react";
import { getProjectModules } from "@/api/modules";
import { ModuleResolver } from "@/lib/moduleResolver";
import type { SelectedModule } from "@/types/module";

const SECTIONS = [
  { key: "objectives", label: "Objectifs du projet", icon: Target, placeholder: "Quels sont les objectifs principaux de ce projet ?" },
  { key: "inScope", label: "Périmètre : In scope", icon: CheckSquare, placeholder: "Ce qui est inclus dans le projet…" },
  { key: "outScope", label: "Périmètre : Out of scope", icon: XSquare, placeholder: "Ce qui n'est PAS inclus dans le projet…" },
  { key: "deliverables", label: "Livrables prévus", icon: Package, placeholder: "Liste des livrables attendus…" },
  { key: "milestones", label: "Planning / jalons clés", icon: CalendarClock, placeholder: "Jalons importants et dates cibles…" },
  { key: "constraints", label: "Hypothèses et contraintes", icon: AlertTriangle, placeholder: "Contraintes techniques, dépendances, hypothèses…" },
  { key: "budgetValidated", label: "Budget validé", icon: Wallet, placeholder: "Montant validé, conditions de paiement…" },
] as const;

type CadrageField = typeof SECTIONS[number]["key"];

/** Derive cadrage seed fields from a linked intake's responses: objectives ←
 *  client's message, in-scope ← selected modules, budget ← validated amount or
 *  the estimate band the client saw. Lets the admin start from the client's own
 *  words instead of a blank page. */
function intakeSeed(raw: Record<string, unknown> | undefined): Partial<Record<CadrageField, string>> {
  if (!raw) return {};
  const out: Partial<Record<CadrageField, string>> = {};
  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  if (message) out.objectives = message;
  const mods = Array.isArray(raw.selectedModules) ? (raw.selectedModules as SelectedModule[]) : [];
  if (mods.length > 0) {
    const txt = new ModuleResolver(mods).toDeliverables();
    if (txt.trim()) out.inScope = txt;
  }
  const est = raw.estimate as { low?: number; high?: number } | undefined;
  if (raw.budget != null && String(raw.budget).trim() !== "") {
    out.budgetValidated = String(raw.budget);
  } else if (est && (est.low != null || est.high != null)) {
    out.budgetValidated = `Estimation client : ${est.low ?? "?"}–${est.high ?? "?"} CHF`;
  }
  return out;
}

export default function ProjectCadrage() {
  const { id } = useParams<{ id: string }>();
  const { projects } = useProjects();
  const { toast } = useToast();
  const project = projects.find((p) => p.id === id);

  const [data, setData] = useState<Record<CadrageField, string>>({
    objectives: "",
    inScope: "",
    outScope: "",
    deliverables: "",
    milestones: "",
    constraints: "",
    budgetValidated: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const c = await getCadrage(id);
        if (c) {
          setData({
            objectives: c.objectives,
            inScope: c.inScope,
            outScope: c.outScope,
            deliverables: c.deliverables,
            milestones: c.milestones,
            constraints: c.constraints,
            budgetValidated: c.budgetValidated,
          });
          return;
        }
        // First-time load: pre-seed from the linked intake (objectives,
        // in-scope, budget) so the cadrage isn't a blank page.
        try {
          const intakes = await getIntakeByProject(id);
          const seed = intakeSeed(intakes?.[0]?.responses as Record<string, unknown> | undefined);
          if (Object.keys(seed).length > 0) {
            setData((prev) => ({ ...prev, ...seed }));
            setDirty(true);
          }
        } catch {}
      } catch {}
      finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleChange = useCallback((key: CadrageField, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  async function handleImportDeliverables() {
    if (!id) return;
    const mods = await getProjectModules(id);
    if (!mods || mods.modules.length === 0) {
      toast({ title: "Aucun module sélectionné", variant: "destructive" });
      return;
    }
    const text = new ModuleResolver(mods.modules).toDeliverables();
    const current = data.deliverables.trim();
    // Check if deliverables text is already present
    if (current && current.includes(text.trim())) {
      toast({ title: "Livrables déjà importés" });
      return;
    }
    // Replace existing module-generated content (lines starting with "- ") or append
    setData((prev) => ({ ...prev, deliverables: current ? `${current}\n${text}` : text }));
    setDirty(true);
    toast({ title: "Livrables importés depuis les modules" });
  }

  async function handleImportFromIntake() {
    if (!id) return;
    try {
      const intakes = await getIntakeByProject(id);
      const seed = intakeSeed(intakes?.[0]?.responses as Record<string, unknown> | undefined);
      if (Object.keys(seed).length === 0) {
        toast({ title: "Aucune donnée d'intake à importer" });
        return;
      }
      // Fill only empty fields — never clobber existing edits.
      setData((prev) => {
        const next = { ...prev };
        (Object.keys(seed) as CadrageField[]).forEach((k) => {
          if (!next[k].trim()) next[k] = seed[k]!;
        });
        return next;
      });
      setDirty(true);
      toast({ title: "Pré-rempli depuis l'intake" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  // Auto-save when dirty (debounced 2s)
  useEffect(() => {
    if (!dirty || !id) return;
    const timer = setTimeout(async () => {
      try {
        await saveCadrage(id, data);
        setDirty(false);
      } catch {
        toast({ title: "Sauvegarde échouée", description: "Vérifiez votre connexion", variant: "destructive" });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [dirty, data, id]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      await saveCadrage(id, data);
      setDirty(false);
      toast({ title: "Cadrage sauvegardé" });
    } catch {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground font-body">
        Projet introuvable.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ProjectStepNav projectId={project.id} currentStep="cadrage" dirty={dirty} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={18} className="text-primary" />
            <h1 className="font-display text-lg font-bold text-foreground">Note de cadrage</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleImportFromIntake} variant="outline" size="sm" className="gap-1.5">
              <Wand2 size={14} /> Intake
            </Button>
            <Button
              onClick={handleSave}
              disabled={!dirty || saving}
              size="sm"
              className="gap-1.5"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Sauvegarder
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <section key={i} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-muted" />
                    <div className="h-3.5 w-32 bg-muted rounded" />
                  </div>
                </div>
                <div className="p-5 space-y-2">
                  <div className="h-2.5 bg-muted/60 rounded w-full" />
                  <div className="h-2.5 bg-muted/60 rounded w-5/6" />
                  <div className="h-2.5 bg-muted/60 rounded w-3/4" />
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {SECTIONS.map(({ key, label, icon: Icon, placeholder }) => (
              <section key={key} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-primary" />
                    <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      {label}
                    </h2>
                  </div>
                  {key === "deliverables" && (
                    <Button variant="ghost" size="sm" className="text-[10px] gap-1 h-6 px-2" onClick={handleImportDeliverables}>
                      <Blocks size={10} /> Modules
                    </Button>
                  )}
                </div>
                <div className="p-4">
                  <Textarea
                    value={data[key]}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                    className="min-h-[80px] resize-y border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 font-body text-sm"
                  />
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
