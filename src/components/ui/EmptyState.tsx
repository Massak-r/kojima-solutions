import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border/50 rounded-xl">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon size={24} className="text-primary" />
      </div>
      <h3 className="font-display text-lg font-bold text-foreground mb-2">{title}</h3>
      <p className="font-body text-sm text-muted-foreground mb-5 max-w-xs leading-relaxed">
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick} className="gap-2">
          {action.icon && <action.icon size={16} />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
