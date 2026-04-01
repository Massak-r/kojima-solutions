import { useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { motion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer, CartesianGrid } from "recharts";

const DATA = [
  { day: 1, progress: 5 },
  { day: 2, progress: 15 },
  { day: 3, progress: 25 },
  { day: 4, progress: 38 },
  { day: 5, progress: 55 },
  { day: 6, progress: 72 },
  { day: 7, progress: 88 },
  { day: 8, progress: 95 },
];

export function LiveChartDemo() {
  const { t } = useLanguage();
  const [inView, setInView] = useState(false);

  return (
    <motion.div
      onViewportEnter={() => setInView(true)}
      viewport={{ once: true, margin: "-50px" }}
      className="space-y-3"
    >
      {/* Chart header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-body font-semibold text-foreground">
            E-commerce MVP
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
            Sprint 8j
          </span>
        </div>
        <span className="text-[10px] font-mono text-emerald-600 font-semibold">95%</span>
      </div>

      {/* Chart */}
      <div className="rounded-xl bg-white/50 dark:bg-white/5 border border-border/30 p-3">
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={DATA} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(215, 45%, 30%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(215, 45%, 30%)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220, 12%, 88%)"
              strokeOpacity={0.4}
              vertical={false}
            />
            <Area
              type="monotone"
              dataKey="progress"
              stroke="hsl(215, 45%, 30%)"
              strokeWidth={2}
              fill="url(#chartGradient)"
              isAnimationActive={inView}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Milestone labels */}
      <div className="flex justify-between px-1 text-[10px] font-mono">
        <span className="text-muted-foreground/50">Design</span>
        <span className="text-muted-foreground/50">Dev</span>
        <span className="text-emerald-600 font-semibold">Live ✓</span>
      </div>
    </motion.div>
  );
}
