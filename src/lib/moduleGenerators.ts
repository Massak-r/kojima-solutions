import type { SelectedModule, ModuleComplexity } from "@/types/module";
import type { TimelineTask, SubTask } from "@/types/timeline";
import type { QuoteLineItem } from "@/types/quote";
import { getModuleById, getModulePrice, COMPLEXITY_LABELS } from "@/data/moduleCatalog";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const CATEGORY_COLORS: Record<string, TimelineTask["color"]> = {
  content: "primary",
  interaction: "accent",
  commerce: "rose",
  system: "violet",
};

/** Generate TimelineTask[] from selected modules */
export function generateTasksFromModules(modules: SelectedModule[]): TimelineTask[] {
  const tasks: TimelineTask[] = [];
  let order = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const sel of modules) {
    const mod = getModuleById(sel.moduleId);
    if (!mod) continue;

    for (const tpl of mod.taskTemplates) {
      tasks.push({
        id: uid(),
        order: order++,
        title: `${tpl.title} (${mod.name})`,
        description: tpl.description,
        date: today,
        dateLabel: "",
        color: CATEGORY_COLORS[mod.category] ?? "primary",
        completed: false,
        subtasks: tpl.subtasks.map((s) => ({ id: uid(), title: s, completed: false })),
      });
    }
  }

  return tasks;
}

/** Generate QuoteLineItem[] from selected modules */
export function generateQuoteLinesFromModules(modules: SelectedModule[]): QuoteLineItem[] {
  return modules.map((sel) => {
    const mod = getModuleById(sel.moduleId);
    if (!mod) return null;
    const label = COMPLEXITY_LABELS[sel.complexity] ?? sel.complexity;
    return {
      id: uid(),
      description: `${mod.quoteLineDescription} (${label})`,
      quantity: 1,
      unitPrice: getModulePrice(sel.moduleId, sel.complexity),
    };
  }).filter(Boolean) as QuoteLineItem[];
}

/** Generate QuoteLineItem[] from project steps (tasks with estimatedHours) */
export function generateQuoteLinesFromSteps(
  tasks: TimelineTask[],
  hourlyRate: number,
): QuoteLineItem[] {
  return tasks
    .filter((t) => t.estimatedHours && t.estimatedHours > 0)
    .map((t) => ({
      id: uid(),
      description: t.title + (t.description ? `\n${t.description}` : ""),
      quantity: t.estimatedHours!,
      unitPrice: hourlyRate,
    }));
}

/** Generate a deliverables markdown list from selected modules */
export function generateDeliverablesFromModules(modules: SelectedModule[]): string {
  return modules
    .map((sel) => {
      const mod = getModuleById(sel.moduleId);
      if (!mod) return "";
      const tier = mod.tiers.find((t) => t.complexity === sel.complexity);
      const label = tier ? `${tier.label} : ${tier.description}` : sel.complexity;
      return `- ${mod.name} (${label})`;
    })
    .filter(Boolean)
    .join("\n");
}

/** Generate funnel phase data from selected modules grouped by category */
export function generatePhasesFromModules(modules: SelectedModule[]) {
  const categoryLabels: Record<string, string> = {
    content: "Contenu",
    interaction: "Interaction",
    commerce: "Commerce",
    system: "Système",
  };

  const grouped = new Map<string, SelectedModule[]>();
  for (const sel of modules) {
    const mod = getModuleById(sel.moduleId);
    if (!mod) continue;
    const cat = mod.category;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(sel);
  }

  const phases: { title: string; description: string; gates: { title: string; description: string }[] }[] = [];
  let order = 0;

  for (const [cat, sels] of grouped) {
    phases.push({
      title: categoryLabels[cat] ?? cat,
      description: `Modules ${categoryLabels[cat]?.toLowerCase() ?? cat}`,
      gates: sels.map((sel) => {
        const mod = getModuleById(sel.moduleId)!;
        const tier = mod.tiers.find((t) => t.complexity === sel.complexity);
        return {
          title: mod.name,
          description: tier ? `${tier.label} : ${tier.description}` : "",
        };
      }),
    });
  }

  return phases;
}
