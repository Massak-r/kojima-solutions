import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

interface ContentType {
  key: string;
  labelFr: string;
  labelEn: string;
  gradient: string;
  format: string;
}

const CONTENT_TYPES: ContentType[] = [
  {
    key: "promo",
    labelFr: "Vidéo promo",
    labelEn: "Promo video",
    gradient: "from-indigo-500 via-violet-500 to-purple-600",
    format: "16:9",
  },
  {
    key: "motion",
    labelFr: "Motion design",
    labelEn: "Motion design",
    gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    format: "16:9",
  },
  {
    key: "social",
    labelFr: "Réseaux sociaux",
    labelEn: "Social media",
    gradient: "from-rose-400 via-pink-500 to-fuchsia-600",
    format: "9:16",
  },
];

// Animated robot presenting a chart/report
function Robot() {
  return (
    <div className="flex items-end gap-2 sm:gap-3 scale-[0.8] sm:scale-100">
      {/* Report/chart that robot presents */}
      <motion.div
        initial={{ opacity: 0, x: -5 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="w-10 h-14 rounded bg-white/15 border border-white/20 p-1.5 flex flex-col justify-between"
      >
        {/* Title line */}
        <div className="h-1 w-5 rounded-full bg-white/30" />
        {/* Mini bar chart */}
        <div className="flex items-end gap-[2px] h-5">
          <motion.div animate={{ scaleY: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 2, delay: 0 }} className="w-1 bg-white/35 rounded-t-[1px] origin-bottom" style={{ height: "60%" }} />
          <motion.div animate={{ scaleY: [0.8, 0.5, 0.8] }} transition={{ repeat: Infinity, duration: 2, delay: 0.2 }} className="w-1 bg-white/35 rounded-t-[1px] origin-bottom" style={{ height: "80%" }} />
          <motion.div animate={{ scaleY: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2, delay: 0.4 }} className="w-1 bg-white/45 rounded-t-[1px] origin-bottom" style={{ height: "100%" }} />
          <motion.div animate={{ scaleY: [0.7, 0.9, 0.7] }} transition={{ repeat: Infinity, duration: 2, delay: 0.6 }} className="w-1 bg-white/35 rounded-t-[1px] origin-bottom" style={{ height: "70%" }} />
        </div>
        {/* Bottom line */}
        <div className="h-[0.5px] w-full bg-white/20" />
        <div className="h-1 w-4 rounded-full bg-white/20" />
      </motion.div>

      {/* Robot */}
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        className="flex flex-col items-center"
      >
        {/* Antenna */}
        <motion.div
          animate={{ rotate: [-8, 8, -8] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="flex flex-col items-center origin-bottom"
        >
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
            className="w-1.5 h-1.5 rounded-full bg-white/60"
          />
          <div className="w-[2px] h-1.5 bg-white/40" />
        </motion.div>
        {/* Head */}
        <motion.div
          animate={{ rotate: [-4, 4, -4] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="w-7 h-5 rounded-md bg-white/25 relative flex items-center justify-center gap-1.5"
        >
          <motion.div
            animate={{ scaleY: [1, 0.1, 1] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 1.2 }}
            className="w-1.5 h-1.5 rounded-full bg-white/80"
          />
          <motion.div
            animate={{ scaleY: [1, 0.1, 1] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 1.2 }}
            className="w-1.5 h-1.5 rounded-full bg-white/80"
          />
          <div className="absolute bottom-[3px] w-2.5 h-1 rounded-b-full border-b-[1.5px] border-x-[0.5px] border-white/40" />
        </motion.div>
        {/* Body */}
        <div className="w-5 h-4 rounded-b-md bg-white/20 mt-[1px] flex items-center justify-center">
          <motion.div
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="w-1.5 h-1.5 rounded-full bg-white/50"
          />
        </div>
        {/* Arms — left points at chart, right relaxed */}
        <div className="flex gap-6 -mt-3.5">
          <motion.div
            animate={{ rotate: [20, 35, 20] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="w-1 h-3 rounded-full bg-white/25 origin-top"
          />
          <div className="w-1 h-2.5 rounded-full bg-white/20" />
        </div>
      </motion.div>
    </div>
  );
}

// 16:9 promo: a page with an embedded video featuring a robot
function PromoContent({ gradient }: { gradient: string }) {
  return (
    <div className="w-full h-full flex flex-col bg-gray-900">
      {/* Nav bar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/5">
        <div className="w-2 h-2 rounded-full bg-white/15" />
        <div className="h-1 w-6 rounded-full bg-white/10" />
        <div className="flex-1" />
        <div className="h-1 w-4 rounded-full bg-white/8" />
        <div className="h-1 w-4 rounded-full bg-white/8" />
      </div>
      {/* Page body */}
      <div className="flex-1 min-h-0 px-3 py-2 flex flex-col gap-1.5 overflow-hidden">
        {/* Video area — fills available space */}
        <div className={cn("flex-1 min-h-0 rounded-md bg-gradient-to-br relative overflow-hidden", gradient)}>
          <div className="absolute inset-0 flex items-center justify-center">
            <Robot />
          </div>
        </div>
        {/* Text lines below video */}
        <div className="space-y-1 shrink-0">
          <div className="h-1.5 w-20 rounded-full bg-white/10" />
          <div className="h-1 w-full rounded-full bg-white/5" />
          <div className="h-1 w-3/4 rounded-full bg-white/5" />
        </div>
      </div>
    </div>
  );
}

// 16:9 motion design: full canvas with animated shapes
function MotionContent({ gradient }: { gradient: string }) {
  return (
    <div className={cn("w-full h-full bg-gradient-to-br relative overflow-hidden", gradient)}>
      {/* Orbiting circle */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white/30" />
      </motion.div>
      {/* Pulsing center shape */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 45, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm"
        />
      </div>
      {/* Floating particles */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{
            y: [-6, 6, -6],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ repeat: Infinity, duration: 2 + i * 0.5, ease: "easeInOut", delay: i * 0.3 }}
          className="absolute w-1.5 h-1.5 rounded-full bg-white/30"
          style={{ top: `${30 + i * 15}%`, left: `${20 + i * 25}%` }}
        />
      ))}
      {/* Bottom bar elements */}
      <div className="absolute bottom-2 left-3 right-3 flex gap-2">
        <div className="h-1.5 w-10 rounded-full bg-white/15" />
        <div className="h-1.5 w-6 rounded-full bg-white/10" />
        <div className="flex-1" />
        <div className="h-1.5 w-8 rounded-full bg-white/10" />
      </div>
    </div>
  );
}

// Animated cat character
function Cat() {
  return (
    <motion.div
      animate={{ y: [0, -2, 0] }}
      transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
      className="flex flex-col items-center"
    >
      {/* Ears */}
      <div className="flex gap-4 mb-[-4px] z-10">
        <motion.div
          animate={{ rotate: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-white/30 origin-bottom"
        />
        <motion.div
          animate={{ rotate: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: 0.5 }}
          className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-white/30 origin-bottom"
        />
      </div>
      {/* Head */}
      <div className="w-9 h-7 rounded-full bg-white/25 relative flex items-center justify-center">
        {/* Eyes */}
        <div className="flex gap-2.5 -mt-0.5">
          <motion.div
            animate={{ scaleY: [1, 0.1, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 2 }}
            className="w-1.5 h-2 rounded-full bg-white/70"
          />
          <motion.div
            animate={{ scaleY: [1, 0.1, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 2 }}
            className="w-1.5 h-2 rounded-full bg-white/70"
          />
        </div>
        {/* Nose */}
        <div className="absolute bottom-1.5 w-1 h-0.5 rounded-full bg-white/40" />
        {/* Whiskers */}
        <div className="absolute bottom-2 left-0 w-2.5 h-[1px] bg-white/20 -rotate-6" />
        <div className="absolute bottom-1.5 left-0 w-2.5 h-[1px] bg-white/20 rotate-6" />
        <div className="absolute bottom-2 right-0 w-2.5 h-[1px] bg-white/20 rotate-6" />
        <div className="absolute bottom-1.5 right-0 w-2.5 h-[1px] bg-white/20 -rotate-6" />
      </div>
      {/* Body */}
      <div className="w-6 h-5 rounded-b-full bg-white/20 -mt-1" />
      {/* Tail */}
      <motion.div
        animate={{ rotate: [-20, 20, -20] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="w-1 h-5 rounded-full bg-white/20 origin-top -mt-3 ml-5 rotate-[30deg]"
      />
    </motion.div>
  );
}

// 9:16 phone: social media vertical video with cat
function SocialContent({ gradient }: { gradient: string }) {
  return (
    <div className={cn("w-full h-full bg-gradient-to-br relative", gradient)}>
      {/* Notch */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-black/15 z-10" />
      {/* Cat character centered */}
      <div className="absolute inset-0 flex items-center justify-center -mt-2 scale-[0.75] sm:scale-100">
        <Cat />
      </div>
      {/* Content overlay */}
      <div className="absolute bottom-10 left-2.5 right-2.5 space-y-1">
        <div className="h-1.5 w-14 rounded-full bg-white/30" />
        <div className="h-1 w-20 rounded-full bg-white/20" />
      </div>
      {/* Bottom nav */}
      <div className="absolute bottom-0 inset-x-0 h-7 bg-black/15 flex items-center justify-around px-3">
        <div className="w-3 h-3 rounded-full bg-white/20" />
        <div className="w-3 h-3 rounded-full bg-white/20" />
        <div className="w-3 h-3 rounded-full bg-white/20" />
        <div className="w-3 h-3 rounded-full bg-white/20" />
      </div>
    </div>
  );
}

export function VideoEditDemo() {
  const { t } = useLanguage();
  const [activeIdx, setActiveIdx] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userInteracted) {
      timerRef.current = setInterval(() => {
        setActiveIdx(i => (i + 1) % CONTENT_TYPES.length);
      }, 3500);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [userInteracted]);

  function select(i: number) {
    setActiveIdx(i);
    setUserInteracted(true);
  }

  const content = CONTENT_TYPES[activeIdx];
  const is916 = content.format === "9:16";

  return (
    <div className="space-y-3">
      {/* Preview canvas */}
      <div className="flex items-center justify-center h-36 sm:h-48 bg-gray-900/[0.03] rounded-xl border border-border/20 relative overflow-hidden">
        {/* Outer frame that morphs via CSS transition */}
        <div
          className={cn(
            "relative overflow-hidden shadow-xl bg-gray-900 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
            is916
              ? "h-[92%] rounded-2xl"
              : content.key === "promo" ? "w-[75%] h-[88%] rounded-lg" : "w-[92%] h-[88%] rounded-xl",
          )}
          style={is916 ? { aspectRatio: "9/16" } : undefined}
        >
          {/* Content crossfade */}
          <AnimatePresence mode="wait">
            <motion.div
              key={content.key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0"
            >
              {content.key === "promo" && <PromoContent gradient={content.gradient} />}
              {content.key === "motion" && <MotionContent gradient={content.gradient} />}
              {content.key === "social" && <SocialContent gradient={content.gradient} />}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>

      {/* Content type selector */}
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
        {CONTENT_TYPES.map((ct, i) => (
          <motion.button
            key={ct.key}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => select(i)}
            className={cn(
              "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-body font-medium transition-all duration-200",
              activeIdx === i
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {t(ct.labelFr, ct.labelEn)}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
