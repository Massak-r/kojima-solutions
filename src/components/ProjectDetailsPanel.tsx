import { ProjectData, STATUS_LABELS, PAYMENT_LABELS } from "@/types/project";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface ProjectDetailsPanelProps {
  project: ProjectData;
  onChange: (updates: Partial<ProjectData>) => void;
}

export function ProjectDetailsPanel({ project, onChange }: ProjectDetailsPanelProps) {
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    financial: false,
    notes: false,
  });

  function toggle(section: keyof typeof expandedSections) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-4">
      <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
        Project Details
      </h3>

      {/* Basic Info */}
      <SectionHeader
        label="General"
        expanded={expandedSections.basic}
        onToggle={() => toggle("basic")}
      />
      {expandedSections.basic && (
        <div className="flex flex-col gap-3">
          <Field label="Client">
            <Input
              placeholder="Client name"
              value={project.client}
              onChange={(e) => onChange({ client: e.target.value })}
              className="text-sm"
            />
          </Field>
          <Field label="Project Description">
            <Textarea
              placeholder="Brief project description..."
              value={project.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={2}
              className="text-sm resize-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start Date">
              <Input
                type="date"
                value={project.startDate}
                onChange={(e) => onChange({ startDate: e.target.value })}
                className="text-sm"
              />
            </Field>
            <Field label="End Date">
              <Input
                type="date"
                value={project.endDate}
                onChange={(e) => onChange({ endDate: e.target.value })}
                className="text-sm"
              />
            </Field>
          </div>
          <Field label="Status">
            <select
              value={project.status}
              onChange={(e) => onChange({ status: e.target.value as ProjectData["status"] })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <Separator />

      {/* Financial */}
      <SectionHeader
        label="Quotes & Invoice"
        expanded={expandedSections.financial}
        onToggle={() => toggle("financial")}
      />
      {expandedSections.financial && (
        <div className="flex flex-col gap-3">
          <Field label="Initial Quote">
            <Input
              placeholder="e.g. $5,000"
              value={project.initialQuote}
              onChange={(e) => onChange({ initialQuote: e.target.value })}
              className="text-sm"
            />
          </Field>
          <Field label="Revised Quote">
            <Input
              placeholder="Leave empty if unchanged"
              value={project.revisedQuote}
              onChange={(e) => onChange({ revisedQuote: e.target.value })}
              className="text-sm"
            />
          </Field>
          <Field label="Invoice Number">
            <Input
              placeholder="e.g. INV-2025-001"
              value={project.invoiceNumber}
              onChange={(e) => onChange({ invoiceNumber: e.target.value })}
              className="text-sm"
            />
          </Field>
          <Field label="Payment Status">
            <select
              value={project.paymentStatus}
              onChange={(e) => onChange({ paymentStatus: e.target.value as ProjectData["paymentStatus"] })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <Separator />

      {/* Notes */}
      <SectionHeader
        label="Notes & Attachments"
        expanded={expandedSections.notes}
        onToggle={() => toggle("notes")}
      />
      {expandedSections.notes && (
        <div className="flex flex-col gap-3">
          <Field label="Notes">
            <Textarea
              placeholder="Additional project notes, links, or references..."
              value={project.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              rows={4}
              className="text-sm resize-none"
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label, expanded, onToggle }: { label: string; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full text-left group"
    >
      <span className="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
        {label}
      </span>
      {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-body text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
