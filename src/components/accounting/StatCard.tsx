import type { ComponentType } from "react";

interface StatCardProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

export function StatCard({ icon: Icon, label, value, sub, accent }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3 ${accent ?? "bg-primary/10"}`}>
        <Icon size={17} className={accent ? "text-white" : "text-primary"} />
      </div>
      <p className="font-body text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="font-display text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="font-body text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
