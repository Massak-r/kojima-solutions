import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layers, Plus, Loader2, User, Mail, BookTemplate, ChevronDown as ChevDown, Printer, Link2, Check, Minus, Save, ListTodo, Package, MessageSquarePlus } from "lucide-react";
import ProjectFeedback from "./ProjectFeedback";
import { cn } from "@/lib/utils";
import { ProjectStepNav } from "@/components/ProjectStepNav";
import { StepCard } from "@/components/funnel/StepCard";
import { GroupHeader } from "@/components/funnel/GroupHeader";
import { ChangeOrderManager } from "@/components/funnel/ChangeOrderManager";
import { TemplateManager } from "@/components/funnel/TemplateManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useProjects } from "@/contexts/ProjectsContext";
import { printViaIframe } from "@/lib/printUtils";
import {
  getFunnelByProject, createFunnel, updateFunnel, createPhase, updatePhase, deletePhase,
  listTemplates, getTemplate, createGate, createOption, createTemplate,
  shareFunnel, unshareFunnel,
  type ProjectFunnel as FunnelType, type FunnelStatus, type Tier, type ProjectTemplate, type FunnelGate, type PhaseTemplate,
} from "@/api/funnels";
import { getProjectModules } from "@/api/modules";
import { generatePhasesFromModules } from "@/lib/moduleGenerators";
import { Blocks } from "lucide-react";

const TEMPLATE_EMOJI: Record<string, string> = {
  Globe: "🌐", ShoppingCart: "🛒", LayoutDashboard: "🖥️", Rocket: "🚀",
  PartyPopper: "🎉", Calendar: "📅", Briefcase: "💼", Code: "💻",
};

const TIER_OPTIONS: { key: Tier; label: string; color: string }[] = [
  { key: "essential", label: "Essentiel", color: "bg-gray-100 text-gray-700" },
  { key: "professional", label: "Professionnel", color: "bg-blue-100 text-blue-700" },
  { key: "custom", label: "Sur mesure", color: "bg-violet-100 text-violet-700" },
];

const STATUS_OPTIONS: { key: FunnelStatus; label: string }[] = [
  { key: "intake", label: "Intake" },
  { key: "proposal", label: "Proposition" },
  { key: "active", label: "Actif" },
  { key: "completed", label: "Terminé" },
];

/** Flatten phases→gates into a flat list with group markers */
interface FlatItem {
  type: "group" | "step";
  phaseId: string;
  phase?: FunnelType["phases"][number];
  gate?: FunnelGate;
  isLastInGroup?: boolean;
}

function flattenPhases(phases: FunnelType["phases"]): FlatItem[] {
  const items: FlatItem[] = [];
  for (const phase of phases) {
    items.push({ type: "group", phaseId: phase.id, phase });
    for (let i = 0; i < phase.gates.length; i++) {
      items.push({
        type: "step",
        phaseId: phase.id,
        gate: phase.gates[i],
        isLastInGroup: i === phase.gates.length - 1,
      });
    }
  }
  return items;
}

export default function ProjectFunnel() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getProject } = useProjects();
  const project = getProject(id!);
  const [funnel, setFunnel] = useState<FunnelType | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [dmName, setDmName] = useState("");
  const [dmEmail, setDmEmail] = useState("");
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [addingStepInPhase, setAddingStepInPhase] = useState<string | null>(null);
  const [newStepTitle, setNewStepTitle] = useState("");
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveTemplateDesc, setSaveTemplateDesc] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  // Tab state removed — both sections now shown stacked

  const fetchFunnel = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getFunnelByProject(id);
      setFunnel(data && data.id ? data : null);
      if (data && data.id) {
        setDmName(data.decisionMakerName ?? "");
        setDmEmail(data.decisionMakerEmail ?? "");
      }
    } catch {
      setFunnel(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchFunnel(); }, [fetchFunnel]);
  useEffect(() => { listTemplates().then(setTemplates).catch(() => {}); }, []);

  const flatItems = useMemo(() => funnel ? flattenPhases(funnel.phases) : [], [funnel]);
  const allGates = useMemo(() => funnel?.phases.flatMap((p) => p.gates) ?? [], [funnel]);
  const approvedCount = allGates.filter((g) => g.status === "approved").length;
  const totalBudget = funnel?.phases.reduce((sum, p) => sum + (p.budget ?? 0), 0) ?? 0;

  async function handleCreate() {
    if (!id) return;
    setCreating(true);
    try {
      const data = await createFunnel({ projectId: id });
      setFunnel(data);
      toast({ title: "Parcours créé" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleAddGroup() {
    if (!funnel || !newGroupTitle.trim()) return;
    try {
      await createPhase({ funnelId: funnel.id, title: newGroupTitle.trim(), phaseOrder: funnel.phases.length });
      setNewGroupTitle("");
      setAddingGroup(false);
      fetchFunnel();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function handleAddStep(phaseId: string) {
    if (!newStepTitle.trim()) return;
    const phase = funnel?.phases.find((p) => p.id === phaseId);
    if (!phase) return;
    try {
      await createGate({
        phaseId,
        title: newStepTitle.trim(),
        gateType: "approval",
        gateOrder: phase.gates.length,
      });
      setNewStepTitle("");
      setAddingStepInPhase(null);
      fetchFunnel();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function handleImportFromModules() {
    if (!id || !funnel) return;
    const data = await getProjectModules(id);
    if (!data || data.modules.length === 0) {
      toast({ title: "Aucun module sélectionné", variant: "destructive" });
      return;
    }
    const phaseData = generatePhasesFromModules(data.modules);
    // Filter out phases whose titles already exist in the funnel
    const existingTitles = new Set(funnel.phases.map((p) => p.title));
    const fresh = phaseData.filter((pd) => !existingTitles.has(pd.title));
    if (fresh.length === 0) {
      toast({ title: "Toutes les phases modules sont déjà importées" });
      return;
    }
    try {
      for (const pd of fresh) {
        const phase = await createPhase({
          funnelId: funnel.id,
          title: pd.title,
          description: pd.description,
          phaseOrder: funnel.phases.length + fresh.indexOf(pd),
        });
        for (let i = 0; i < pd.gates.length; i++) {
          await createGate({
            phaseId: phase.id,
            title: pd.gates[i].title,
            description: pd.gates[i].description,
            gateType: "approval",
            gateOrder: i,
          });
        }
      }
      fetchFunnel();
      toast({ title: `${fresh.length} phases importées` });
    } catch {
      toast({ title: "Erreur d'import", variant: "destructive" });
    }
  }

  async function handleDeleteGroup(phaseId: string) {
    try {
      await deletePhase(phaseId);
      fetchFunnel();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function handleTierChange(tier: Tier) {
    if (!funnel) return;
    try { await updateFunnel(funnel.id, { tier }); fetchFunnel(); } catch {}
  }

  async function handleStatusChange(status: FunnelStatus) {
    if (!funnel) return;
    try { await updateFunnel(funnel.id, { status }); fetchFunnel(); } catch {}
  }

  async function handleSaveMeta() {
    if (!funnel) return;
    try {
      await updateFunnel(funnel.id, { decisionMakerName: dmName || undefined, decisionMakerEmail: dmEmail || undefined });
      setEditingMeta(false);
      fetchFunnel();
    } catch {}
  }

  async function handleApplyTemplate(templateId: string) {
    if (!funnel) return;
    setApplyingTemplate(true);
    try {
      const tpl = await getTemplate(templateId);
      if (tpl.defaultTier) {
        await updateFunnel(funnel.id, { tier: tpl.defaultTier, templateId });
      }
      for (let pIdx = 0; pIdx < (tpl.phasesJson ?? []).length; pIdx++) {
        const phaseTpl = tpl.phasesJson[pIdx];
        const phase = await createPhase({
          funnelId: funnel.id,
          title: phaseTpl.title,
          phaseOrder: funnel.phases.length + pIdx,
          budget: phaseTpl.budget,
        });
        for (let gIdx = 0; gIdx < (phaseTpl.gates ?? []).length; gIdx++) {
          const gateTpl = phaseTpl.gates[gIdx];
          const gate = await createGate({
            phaseId: phase.id,
            title: gateTpl.title,
            description: gateTpl.description,
            gateType: gateTpl.gateType,
            gateOrder: gIdx,
            revisionLimit: gateTpl.revisionLimit,
          });
          for (let oIdx = 0; oIdx < (gateTpl.options ?? []).length; oIdx++) {
            const opt = gateTpl.options[oIdx];
            await createOption({
              gateId: gate.id,
              title: opt.title,
              description: opt.description,
              isRecommended: opt.isRecommended,
              optionOrder: oIdx,
            });
          }
        }
      }
      setTemplateSheetOpen(false);
      fetchFunnel();
      toast({ title: "Template appliqué" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setApplyingTemplate(false);
    }
  }

  async function handleSaveAsTemplate() {
    if (!funnel || !saveTemplateName.trim()) return;
    setSavingTemplate(true);
    try {
      const phasesJson: PhaseTemplate[] = funnel.phases.map((p) => ({
        title: p.title,
        description: "",
        budget: p.budget ?? undefined,
        gates: p.gates.map((g) => ({
          title: g.title,
          description: g.description,
          gateType: g.gateType,
          revisionLimit: g.revisionLimit,
          options: g.options?.map((o) => ({
            title: o.title,
            description: o.description,
            isRecommended: o.isRecommended,
          })),
        })),
      }));
      await createTemplate({
        name: saveTemplateName.trim(),
        description: saveTemplateDesc.trim(),
        icon: "📋",
        defaultTier: funnel.tier,
        phasesJson,
      });
      setSaveTemplateOpen(false);
      setSaveTemplateName("");
      setSaveTemplateDesc("");
      toast({ title: "Template créé" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSavingTemplate(false);
    }
  }

  // Count linked tasks per phase
  const tasksByPhase = useMemo(() => {
    const map: Record<string, number> = {};
    if (project) {
      for (const task of project.tasks) {
        if (task.phaseId) {
          map[task.phaseId] = (map[task.phaseId] || 0) + 1;
        }
      }
    }
    return map;
  }, [project]);

  async function handleGroupTitleChange(phaseId: string, title: string) {
    try { await updatePhase(phaseId, { title }); fetchFunnel(); } catch {}
  }

  async function handleGroupBudgetChange(phaseId: string, budget: number) {
    try { await updatePhase(phaseId, { budget }); fetchFunnel(); } catch {}
  }

  return (
    <div className="min-h-screen bg-background">
      <ProjectStepNav projectId={id!} currentStep="suivi" />

      {/* Sub-navigation anchors */}
      <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-sm border-b border-border/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center gap-2 py-2">
          <button
            onClick={() => document.getElementById("section-parcours")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="text-[11px] font-body font-medium px-3 py-1 rounded-full bg-card border border-border/60 hover:border-primary/40 hover:text-primary transition-colors"
          >
            Parcours de validation
          </button>
          <button
            onClick={() => document.getElementById("section-retours")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="text-[11px] font-body font-medium px-3 py-1 rounded-full bg-card border border-border/60 hover:border-primary/40 hover:text-primary transition-colors"
          >
            Retours & Livrables
          </button>
        </div>
      </div>

      <div id="section-parcours" className="scroll-mt-28 max-w-3xl mx-auto px-4 sm:px-6 py-6 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-muted-foreground/40" />
          </div>
        ) : !funnel ? (
          /* No funnel yet */
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Layers size={28} className="text-primary" />
            </div>
            <h2 className="text-lg font-display font-bold text-foreground/80">Parcours de validation</h2>
            <p className="text-sm text-muted-foreground/50 font-body max-w-md mx-auto">
              Créez un parcours pour structurer les étapes de validation du projet avec votre client.
            </p>
            <Button onClick={handleCreate} disabled={creating} className="mt-4">
              {creating ? <Loader2 size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
              Créer le parcours
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Meta header */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-primary shrink-0" />
                  <h2 className="font-display text-sm font-bold text-foreground/80">Parcours de validation</h2>

                  {allGates.length > 0 && (
                    <span className="text-[10px] font-mono text-muted-foreground ml-1">
                      {approvedCount}/{allGates.length} étapes validées
                    </span>
                  )}

                  <div className="flex items-center gap-1 ml-auto sm:mr-4">
                    <Sheet open={templateSheetOpen} onOpenChange={setTemplateSheetOpen}>
                      <SheetTrigger asChild>
                        <button
                          className="p-1.5 text-muted-foreground/40 hover:text-primary transition-colors"
                          title="Templates"
                        >
                          <BookTemplate size={14} />
                        </button>
                      </SheetTrigger>
                      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                        <SheetHeader>
                          <SheetTitle className="font-display">Templates</SheetTitle>
                        </SheetHeader>
                        <div className="mt-4">
                          <TemplateManager onApply={(tplId) => handleApplyTemplate(tplId)} />
                        </div>
                      </SheetContent>
                    </Sheet>
                    {funnel.phases.length > 0 && (
                      <button
                        onClick={() => { setSaveTemplateName(""); setSaveTemplateDesc(""); setSaveTemplateOpen(true); }}
                        className="p-1.5 text-muted-foreground/40 hover:text-primary transition-colors"
                        title="Sauvegarder comme template"
                      >
                        <Save size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => printViaIframe(`/funnel/${funnel.id}/print`)}
                      className="p-1.5 text-muted-foreground/40 hover:text-primary transition-colors"
                      title="Exporter PDF"
                    >
                      <Printer size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          let token = funnel.shareToken;
                          if (!token) {
                            const updated = await shareFunnel(funnel.id);
                            token = updated.shareToken;
                            setFunnel(updated);
                          }
                          const url = `${window.location.origin}/funnel/s/${token}`;
                          await navigator.clipboard.writeText(url);
                          setCopiedLink(true);
                          toast({ title: "Lien stakeholder copié" });
                          setTimeout(() => setCopiedLink(false), 2000);
                        } catch {
                          toast({ title: "Erreur", variant: "destructive" });
                        }
                      }}
                      className="p-1.5 text-muted-foreground/40 hover:text-primary transition-colors"
                      title="Copier lien stakeholder"
                    >
                      {copiedLink ? <Check size={14} className="text-emerald-500" /> : <Link2 size={14} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 sm:gap-1 bg-secondary/40 rounded-full p-0.5 overflow-x-auto scrollbar-hide">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => handleStatusChange(s.key)}
                      className={cn(
                        "text-[9px] sm:text-[10px] font-body font-medium px-2 sm:px-2.5 py-0.5 rounded-full transition-all whitespace-nowrap shrink-0",
                        funnel.status === s.key
                          ? "bg-primary/10 text-primary font-semibold shadow-sm"
                          : "text-muted-foreground/50 hover:text-muted-foreground",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tier + budget */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-xs text-muted-foreground/50 font-body">Forfait:</span>
                {TIER_OPTIONS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => handleTierChange(t.key)}
                    className={cn(
                      "text-[10px] sm:text-xs font-body px-2 sm:px-2.5 py-0.5 rounded-full transition-all border",
                      funnel.tier === t.key
                        ? cn(t.color, "border-current/20 font-semibold")
                        : "border-transparent text-muted-foreground/40 hover:text-muted-foreground",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
                {totalBudget > 0 && (
                  <span className="w-full sm:w-auto sm:ml-auto text-xs font-body text-muted-foreground/50">
                    Budget: <strong className="text-foreground/70">{totalBudget.toLocaleString("fr-CH")} CHF</strong>
                  </span>
                )}
              </div>

              {/* Decision maker */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-xs min-w-0 overflow-hidden">
                <User size={12} className="text-muted-foreground/40 shrink-0" />
                {editingMeta ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 flex-1">
                    <input
                      type="text" value={dmName} onChange={(e) => setDmName(e.target.value)}
                      placeholder="Nom du décideur..."
                      className="text-xs font-body bg-secondary/30 border border-border/30 rounded-md px-2 py-1 sm:py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/20 w-full sm:w-36"
                    />
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Mail size={12} className="text-muted-foreground/40 shrink-0" />
                      <input
                        type="email" value={dmEmail} onChange={(e) => setDmEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="text-xs font-body bg-secondary/30 border border-border/30 rounded-md px-2 py-1 sm:py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/20 flex-1 sm:w-48"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleSaveMeta} className="text-xs text-primary font-medium">OK</button>
                      <button onClick={() => setEditingMeta(false)} className="text-xs text-muted-foreground">Annuler</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setEditingMeta(true)} className="text-xs text-muted-foreground/50 hover:text-foreground font-body transition-colors">
                    {funnel.decisionMakerName || funnel.decisionMakerEmail
                      ? `${funnel.decisionMakerName ?? ""} ${funnel.decisionMakerEmail ? `(${funnel.decisionMakerEmail})` : ""}`.trim()
                      : "Définir le décideur..."
                    }
                  </button>
                )}
              </div>
            </div>

            {/* ── Flat step list with group headers ── */}
            <div className="space-y-0">
              {flatItems.map((item, idx) => {
                if (item.type === "group" && item.phase) {
                  const phase = item.phase;
                  const phaseApproved = phase.gates.filter((g) => g.status === "approved").length;
                  return (
                    <div key={`group-${phase.id}`}>
                      <GroupHeader
                        title={phase.title}
                        budget={phase.budget ?? 0}
                        approvedCount={phaseApproved}
                        totalCount={phase.gates.length}
                        onTitleChange={(t) => handleGroupTitleChange(phase.id, t)}
                        onBudgetChange={(b) => handleGroupBudgetChange(phase.id, b)}
                        onDelete={() => handleDeleteGroup(phase.id)}
                        collapsed={collapsedPhases.has(phase.id)}
                        onToggleCollapse={() => setCollapsedPhases((prev) => {
                          const next = new Set(prev);
                          next.has(phase.id) ? next.delete(phase.id) : next.add(phase.id);
                          return next;
                        })}
                        linkedTaskCount={tasksByPhase[phase.id] ?? 0}
                        onNavigateToTasks={() => navigate(`/project/${id}/planning`)}
                      />

                      {/* Add step in this group (when group is empty or inline add is active) */}
                      {!collapsedPhases.has(phase.id) && phase.gates.length === 0 && (
                        <div className="ml-9 mb-2">
                          {addingStepInPhase === phase.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={newStepTitle}
                                onChange={(e) => setNewStepTitle(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAddStep(phase.id)}
                                placeholder="Titre de l'étape..."
                                className="flex-1 text-sm font-body bg-secondary/30 border border-border/30 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/30"
                                autoFocus
                              />
                              <Button size="sm" onClick={() => handleAddStep(phase.id)} disabled={!newStepTitle.trim()} className="h-7 text-xs">Ajouter</Button>
                              <button onClick={() => { setAddingStepInPhase(null); setNewStepTitle(""); }} className="text-xs text-muted-foreground">Annuler</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAddingStepInPhase(phase.id); setNewStepTitle(""); }}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground/40 hover:text-primary transition-colors font-body py-1"
                            >
                              <Plus size={12} /> Ajouter une étape
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                if (item.type === "step" && item.gate) {
                  if (collapsedPhases.has(item.phaseId)) return null;
                  const isLastStep = idx === flatItems.length - 1 || flatItems[idx + 1]?.type === "group";
                  return (
                    <div key={`step-${item.gate.id}`} className="ml-4">
                      <StepCard
                        gate={item.gate}
                        onUpdate={fetchFunnel}
                        isLast={isLastStep}
                      />

                      {/* Inline add step after last step in group */}
                      {item.isLastInGroup && (
                        <div className="ml-9 mb-1">
                          {addingStepInPhase === item.phaseId ? (
                            <div className="flex items-center gap-2 py-1">
                              <input
                                type="text"
                                value={newStepTitle}
                                onChange={(e) => setNewStepTitle(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAddStep(item.phaseId)}
                                placeholder="Titre de l'étape..."
                                className="flex-1 text-sm font-body bg-secondary/30 border border-border/30 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/30"
                                autoFocus
                              />
                              <Button size="sm" onClick={() => handleAddStep(item.phaseId)} disabled={!newStepTitle.trim()} className="h-7 text-xs">Ajouter</Button>
                              <button onClick={() => { setAddingStepInPhase(null); setNewStepTitle(""); }} className="text-xs text-muted-foreground">Annuler</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAddingStepInPhase(item.phaseId); setNewStepTitle(""); }}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground/30 hover:text-primary transition-colors font-body py-1"
                            >
                              <Plus size={11} /> Ajouter une étape
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                return null;
              })}
            </div>

            {/* Add group */}
            {addingGroup ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newGroupTitle}
                  onChange={(e) => setNewGroupTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
                  placeholder="Nom du groupe (ex: Phase 1 - Conception)"
                  className="flex-1 text-sm font-body bg-secondary/30 border border-border/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/30"
                  autoFocus
                />
                <Button size="sm" onClick={handleAddGroup} disabled={!newGroupTitle.trim()}>Ajouter</Button>
                <button onClick={() => { setAddingGroup(false); setNewGroupTitle(""); }} className="text-sm text-muted-foreground">Annuler</button>
              </div>
            ) : (
              <button
                onClick={() => setAddingGroup(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border/40 rounded-xl text-sm text-muted-foreground/40 hover:text-primary hover:border-primary/30 transition-colors font-body"
              >
                <Plus size={14} /> Ajouter un groupe
              </button>
            )}

            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={handleImportFromModules}>
              <Blocks size={14} /> Importer depuis les modules
            </Button>

            {funnel.phases.length === 0 && (
              <p className="text-center text-xs text-muted-foreground/30 font-body pt-4">
                Commencez par ajouter des groupes, puis des étapes de validation à chaque groupe.
              </p>
            )}

            {/* Change Orders */}
            {allGates.length > 0 && (
              <ChangeOrderManager
                funnelId={funnel.id}
                gates={allGates}
              />
            )}
          </div>
        )}
      </div>

      {/* Retours & Livrables */}
      <div id="section-retours" className="max-w-3xl mx-auto px-4 sm:px-6 pb-6 scroll-mt-28">
        <div className="border-t border-border/40 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package size={14} className="text-primary" />
              <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Retours & Livrables
              </h2>
            </div>
          </div>

          {/* Client URLs info card */}
          <div className="bg-muted/30 border border-border/40 rounded-lg p-3 mb-4 space-y-2">
            <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider">Liens client</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={async () => {
                  const project = getProject(id!);
                  const slug = project?.clientSlug || id;
                  const url = `${window.location.origin}/client/${slug}`;
                  await navigator.clipboard.writeText(url);
                  toast({ title: "Lien portail client copié" });
                }}
                className="flex-1 flex items-center gap-2 text-left bg-card border border-border/60 rounded-md px-3 py-2 hover:border-primary/40 transition-colors group"
              >
                <Link2 size={12} className="text-primary shrink-0" />
                <div>
                  <p className="text-[11px] font-body font-semibold text-foreground/80 group-hover:text-primary">Portail client</p>
                  <p className="text-[9px] text-muted-foreground/60">Espace complet — parcours, retours, livrables, factures. Accès par email.</p>
                </div>
              </button>
              {funnel?.shareToken && (
                <button
                  onClick={async () => {
                    const url = `${window.location.origin}/funnel/s/${funnel.shareToken}`;
                    await navigator.clipboard.writeText(url);
                    toast({ title: "Lien parcours copié" });
                  }}
                  className="flex-1 flex items-center gap-2 text-left bg-card border border-border/60 rounded-md px-3 py-2 hover:border-primary/40 transition-colors group"
                >
                  <Link2 size={12} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[11px] font-body font-semibold text-foreground/80 group-hover:text-primary">Lien parcours</p>
                    <p className="text-[9px] text-muted-foreground/60">Vue lecture seule du parcours. Partageable avec d'autres parties prenantes.</p>
                  </div>
                </button>
              )}
            </div>
          </div>

          <ProjectFeedback />
        </div>
      </div>

      {/* Save as Template dialog */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Sauvegarder comme template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Nom</label>
              <Input
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="Ex: Site e-commerce"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Description (optionnel)</label>
              <Input
                value={saveTemplateDesc}
                onChange={(e) => setSaveTemplateDesc(e.target.value)}
                placeholder="Parcours type pour..."
              />
            </div>
            <p className="text-[10px] text-muted-foreground/50 font-body">
              {funnel?.phases.length ?? 0} groupes et {allGates.length} étapes seront copiés dans le template.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveAsTemplate} disabled={!saveTemplateName.trim() || savingTemplate}>
              {savingTemplate ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
