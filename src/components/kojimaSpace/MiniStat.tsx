interface MiniStatProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  pulse?: boolean;
  onClick?: () => void;
}

export function MiniStat({ icon, label, value, pulse, onClick }: MiniStatProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-secondary/60 transition-colors relative"
    >
      {icon}
      <span className="font-display text-sm font-bold text-foreground">{value}</span>
      <span className="text-[10px] font-body text-muted-foreground">{label}</span>
      {pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-palette-amber animate-pulse" />
      )}
    </button>
  );
}
