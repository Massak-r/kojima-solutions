import type { SelectedModule } from "@/types/module";
import type { TimelineTask } from "@/types/timeline";
import type { QuoteLineItem } from "@/types/quote";
import { getModuleById, getModulePrice, COMPLEXITY_LABELS } from "@/data/moduleCatalog";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const CATEGORY_COLORS: Record<string, TimelineTask["color"]> = {
  content: "primary",
  interaction: "accent",
  commerce: "rose",
  system: "violet",
};

const CATEGORY_LABELS: Record<string, string> = {
  content: "Contenu",
  interaction: "Interaction",
  commerce: "Commerce",
  system: "Système",
};

export interface ResolvedPhase {
  title: string;
  description: string;
  gates: Array<{ title: string; description: string }>;
}

// Single source of truth for derivations from a module selection. Replaces
// the previously scattered generate*FromModules helpers: cadrage deliverables,
// project timeline tasks, funnel phases, and quote lines all go through here.
export class ModuleResolver {
  constructor(private readonly selection: ReadonlyArray<SelectedModule>) {}

  get isEmpty(): boolean {
    return this.selection.length === 0;
  }

  get count(): number {
    return this.selection.length;
  }

  get modules(): ReadonlyArray<SelectedModule> {
    return this.selection;
  }

  toTasks(): TimelineTask[] {
    const tasks: TimelineTask[] = [];
    let order = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const sel of this.selection) {
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

  toQuoteLines(): QuoteLineItem[] {
    const lines: QuoteLineItem[] = [];
    for (const sel of this.selection) {
      const mod = getModuleById(sel.moduleId);
      if (!mod) continue;
      const label = COMPLEXITY_LABELS[sel.complexity] ?? sel.complexity;
      lines.push({
        id: uid(),
        description: `${mod.quoteLineDescription} (${label})`,
        quantity: 1,
        unitPrice: getModulePrice(sel.moduleId, sel.complexity),
        sourceModuleId: sel.moduleId,
        sourceComplexity: sel.complexity,
      });
    }
    return lines;
  }

  toDeliverables(): string {
    return this.selection
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

  toPhases(): ResolvedPhase[] {
    const grouped = new Map<string, SelectedModule[]>();
    for (const sel of this.selection) {
      const mod = getModuleById(sel.moduleId);
      if (!mod) continue;
      if (!grouped.has(mod.category)) grouped.set(mod.category, []);
      grouped.get(mod.category)!.push(sel);
    }
    const phases: ResolvedPhase[] = [];
    for (const [cat, sels] of grouped) {
      phases.push({
        title: CATEGORY_LABELS[cat] ?? cat,
        description: `Modules ${(CATEGORY_LABELS[cat] ?? cat).toLowerCase()}`,
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
}

// Step-based quote generation is intentionally separate — it derives lines
// from TimelineTask.estimatedHours, not from the module catalog. Kept here so
// quote-line generation paths share a module.
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
