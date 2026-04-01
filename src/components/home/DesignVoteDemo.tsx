import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Option {
  id: string;
  labelFr: string;
  labelEn: string;
  color: string;
  accentColor: string;
  layout: "dashboard" | "landing" | "portfolio";
  votes: number;
}

const INITIAL_OPTIONS: Option[] = [
  { id: "a", labelFr: "Dashboard", labelEn: "Dashboard", color: "bg-primary/10 border-primary/20", accentColor: "bg-primary", layout: "dashboard", votes: 12 },
  { id: "b", labelFr: "Landing", labelEn: "Landing", color: "bg-palette-violet/10 border-palette-violet/20", accentColor: "bg-palette-violet", layout: "landing", votes: 24 },
  { id: "c", labelFr: "Portfolio", labelEn: "Portfolio", color: "bg-palette-sage/10 border-palette-sage/20", accentColor: "bg-palette-sage", layout: "portfolio", votes: 8 },
];

function MiniMockup({ layout, accent }: { layout: Option["layout"]; accent: string }) {
  const bar = "bg-current opacity-[0.12] rounded-[1px]";
  const fill = "bg-current opacity-[0.06] rounded-[1px]";

  if (layout === "dashboard") {
    return (
      <div className="flex flex-col gap-[2px] h-full">
        <div className={cn("h-[12%] w-full rounded-[1px]", accent, "opacity-30")} />
        <div className="flex gap-[2px] flex-1">
          <div className="w-[22%] flex flex-col gap-[2px] py-[2px]">
            <div className={cn(bar, "h-[3px] w-full")} />
            <div className={cn(bar, "h-[3px] w-[70%]")} />
            <div className={cn(bar, "h-[3px] w-[85%]")} />
          </div>
          <div className="flex-1 flex flex-col gap-[2px]">
            <div className="flex gap-[2px] h-[40%]">
              <div className={cn(fill, "flex-1")} />
              <div className={cn(fill, "flex-1")} />
              <div className={cn("flex-1 rounded-[1px]", accent, "opacity-20")} />
            </div>
            <div className={cn(fill, "flex-1")} />
          </div>
        </div>
      </div>
    );
  }

  if (layout === "landing") {
    return (
      <div className="flex flex-col gap-[2px] h-full">
        <div className={cn("h-[8%] w-full rounded-[1px]", accent, "opacity-25")} />
        <div className={cn(fill, "h-[30%] w-full")} />
        <div className="flex justify-center py-[1px]">
          <div className={cn("w-[55%] h-[5px] rounded-[2px]", accent, "opacity-40")} />
        </div>
        <div className="flex gap-[2px] flex-1 px-[6%]">
          <div className={cn(fill, "flex-1")} />
          <div className={cn(fill, "flex-1")} />
          <div className={cn(fill, "flex-1")} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[2px] h-full">
      <div className="flex items-center gap-[3px] h-[10%]">
        <div className={cn("w-[15%] h-full rounded-[1px]", accent, "opacity-30")} />
        <div className="flex-1" />
        <div className={cn(bar, "w-[8%] h-[3px]")} />
        <div className={cn(bar, "w-[8%] h-[3px]")} />
      </div>
      <div className={cn(fill, "h-[48%] w-full")} />
      <div className="flex gap-[3px] flex-1">
        <div className="flex-1 flex flex-col gap-[1px]">
          <div className={cn(bar, "h-[3px] w-[80%]")} />
          <div className={cn(bar, "h-[2px] w-full opacity-[0.05]")} />
        </div>
        <div className="flex-1 flex flex-col gap-[1px]">
          <div className={cn(bar, "h-[3px] w-[60%]")} />
          <div className={cn(bar, "h-[2px] w-full opacity-[0.05]")} />
        </div>
      </div>
    </div>
  );
}

export function DesignVoteDemo() {
  const { t } = useLanguage();
  const [options, setOptions] = useState(INITIAL_OPTIONS);

  function vote(id: string) {
    setOptions(prev =>
      prev.map(o => o.id === id ? { ...o, votes: o.votes + 1 } : o)
    );
  }

  const maxVotes = Math.max(...options.map(o => o.votes));

  return (
    <div className="mt-3 relative z-30">
      <p className="text-[10px] text-muted-foreground/60 font-body mb-2 text-center">
        {t("Cliquez pour voter", "Click to vote")}
      </p>
      <div className="flex gap-2.5 justify-center">
        {options.map(opt => {
          const isLeading = opt.votes === maxVotes;
          return (
            <motion.button
              key={opt.id}
              onClick={() => vote(opt.id)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-colors duration-200 cursor-pointer",
                opt.color,
                isLeading && "ring-1 ring-emerald-500/40 shadow-sm",
              )}
            >
              {/* Mini mockup */}
              <div className="w-16 h-12 sm:w-20 sm:h-14 text-foreground rounded-md overflow-hidden bg-white/50 p-[2px]">
                <MiniMockup layout={opt.layout} accent={opt.accentColor} />
              </div>

              {/* Label */}
              <span className="text-[8px] font-mono text-muted-foreground/70 uppercase tracking-wider">
                {t(opt.labelFr, opt.labelEn)}
              </span>

              {/* Vote count */}
              <div className="flex items-center gap-0.5">
                {isLeading && (
                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                )}
                <motion.span
                  key={opt.votes}
                  initial={{ scale: 1.4, color: "hsl(145, 40%, 40%)" }}
                  animate={{ scale: 1, color: "hsl(220, 12%, 48%)" }}
                  transition={{ duration: 0.3 }}
                  className="text-[10px] font-mono font-semibold"
                >
                  {opt.votes}
                </motion.span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
