import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  icon?: React.FC<{ size?: number; className?: string }>;
  /** Icon colour utility (defaults to text-primary). */
  iconClassName?: string;
  title: string;
  subtitle?: string;
  /** Optional element rendered at the right of the header (e.g. a button). */
  action?: ReactNode;
  className?: string;
  /** Override body padding — pass "p-0" for flush lists. */
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * Shared section card: bordered card with an icon + uppercase title header and
 * a content body. Consolidates the repeated
 * `bg-card border rounded-2xl` + header pattern used across the app.
 */
export function SectionCard({ icon: Icon, iconClassName, title, subtitle, action, className, bodyClassName, children }: SectionCardProps) {
  return (
    <section className={cn("bg-card border border-border rounded-2xl overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={15} className={cn("shrink-0", iconClassName ?? "text-primary")} />}
          <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest truncate">{title}</h2>
          {subtitle && <span className="font-body text-xs text-muted-foreground/70 shrink-0">{subtitle}</span>}
        </div>
        {action}
      </div>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
