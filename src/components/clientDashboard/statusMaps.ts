import type { ProjectData } from "@/types/project";

export const COLOR_MAP: Record<string, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  secondary: "bg-secondary",
  rose: "bg-palette-rose",
  sage: "bg-palette-sage",
  amber: "bg-palette-amber",
  violet: "bg-palette-violet",
};

export const STATUS_BADGE: Record<ProjectData["status"], { label: string; className: string }> = {
  draft:         { label: "Brouillon",   className: "bg-muted text-muted-foreground border-border" },
  "in-progress": { label: "En cours",    className: "bg-primary/10 text-primary border-primary/30" },
  completed:     { label: "Terminé",     className: "bg-palette-sage/20 text-palette-sage border-palette-sage/30" },
  "on-hold":     { label: "En pause",    className: "bg-palette-amber/20 text-palette-amber border-palette-amber/30" },
};

export const INVOICE_STATUS: Record<string, { label: string; className: string }> = {
  draft:         { label: "Brouillon",   className: "bg-muted text-muted-foreground border-border" },
  "to-validate": { label: "En attente",  className: "bg-palette-amber/15 text-palette-amber border-palette-amber/30" },
  validated:     { label: "Validé",      className: "bg-palette-sage/15 text-palette-sage border-palette-sage/30" },
  paid:          { label: "Payé",        className: "bg-primary/10 text-primary border-primary/30" },
  "on-hold":     { label: "En pause",    className: "bg-palette-rose/15 text-palette-rose border-palette-rose/30" },
};
