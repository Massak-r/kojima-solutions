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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Blocks } from "lucide-react";
import { getProjectModules } from "@/api/modules";
import { ModuleResolver } from "@/lib/moduleResolver";

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
        // First-time load: seed budgetValidated from intake if one is linked.
        try {
          const intakes = await getIntakeByProject(id);
          const intake = intakes?.[0];
          const raw = intake?.responses as Record<string, unknown> | undefined;
          const budget = raw?.budget ?? raw?.budgetValidated;
          if (budget !== undefined && budget !== null && String(budget).trim() !== "") {
            setData((prev) => ({ ...prev, budgetValidated: String(budget) }));
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

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
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
