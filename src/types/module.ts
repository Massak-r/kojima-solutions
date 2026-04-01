export type ModuleComplexity = "simple" | "advanced" | "custom";

export type MaintenanceTier = "none" | "basic" | "custom";

export interface ModuleTier {
  complexity: ModuleComplexity;
  label: string;
  description: string;
  price: number;
  yearlyFee?: number;
  estimatedHours: number;
  features: string[];
}

export interface TaskTemplate {
  title: string;
  description: string;
  subtasks: string[];
}

export interface ModuleDefinition {
  id: string;
  slug: string;
  name: string;
  icon: string;
  category: "content" | "interaction" | "commerce" | "system";
  description: string;
  tiers: [ModuleTier, ModuleTier, ModuleTier];
  taskTemplates: TaskTemplate[];
  quoteLineDescription: string;
  previewType: string;
}

export interface SelectedModule {
  moduleId: string;
  complexity: ModuleComplexity;
  customNotes?: string;
}

export interface ProjectModules {
  projectId: string;
  modules: SelectedModule[];
  maintenance: MaintenanceTier;
}
