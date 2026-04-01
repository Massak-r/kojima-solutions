import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

const THEMES = [
  { key: "indigo", accent: "bg-indigo-500", accentLight: "bg-indigo-100", ring: "ring-indigo-500" },
  { key: "emerald", accent: "bg-emerald-500", accentLight: "bg-emerald-100", ring: "ring-emerald-500" },
  { key: "rose", accent: "bg-rose-500", accentLight: "bg-rose-100", ring: "ring-rose-500" },
];

const PAGES = [
  { key: "home", fr: "Accueil", en: "Home" },
  { key: "about", fr: "À propos", en: "About" },
];

export function SitePreviewDemo() {
  const { t } = useLanguage();
  const [themeIdx, setThemeIdx] = useState(0);
  const [activePage, setActivePage] = useState("home");
  const [ctaClicked, setCtaClicked] = useState(false);
  const theme = THEMES[themeIdx];

  const line = "bg-gray-200";
  const titleBg = "bg-gray-700";
  const cardBg = "bg-gray-50";

  function handleCta() {
    setCtaClicked(true);
    setTimeout(() => setCtaClicked(false), 1200);
  }

  return (
    <div className="space-y-3">
      {/* Color swatches */}
      <div className="flex items-center gap-1.5 px-1">
        {THEMES.map((th, i) => (
          <motion.button
            key={th.key}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setThemeIdx(i)}
            className={cn(
              "w-5 h-5 rounded-full transition-all duration-200",
              th.accent,
              themeIdx === i ? `ring-2 ${th.ring} ring-offset-2 scale-110` : "opacity-50 hover:opacity-100",
            )}
          />
        ))}
      </div>

      {/* Mini website frame */}
      <div className="rounded-xl border border-border/40 overflow-hidden bg-white">
        {/* Nav bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50/90 border-gray-100">
          <div className="flex items-center gap-1.5">
            <motion.div
              animate={{ rotate: themeIdx * 120 }}
              transition={{ duration: 0.4 }}
              className={cn("w-2.5 h-2.5 rounded transition-colors duration-400", theme.accent)}
            />
            <div className="h-1.5 w-8 rounded-full bg-gray-200" />
          </div>
          <div className="flex gap-1">
            {PAGES.map(page => (
              <button
                key={page.key}
                onClick={() => setActivePage(page.key)}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[7px] font-mono transition-all duration-200",
                  activePage === page.key
                    ? cn(theme.accent, "text-white")
                    : "text-gray-400 hover:text-gray-600",
                )}
              >
                {t(page.fr, page.en)}
              </button>
            ))}
          </div>
        </div>

        {/* Page content */}
        <AnimatePresence mode="wait">
          {activePage === "home" ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="px-4 py-4 text-center">
                <div className="h-1.5 w-20 mx-auto rounded-full mb-1.5 bg-gray-200" />
                <div className="h-2.5 w-28 mx-auto rounded-full mb-2.5 bg-gray-700" />
                <motion.button
                  onClick={handleCta}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className={cn("h-5 w-20 mx-auto rounded-md transition-colors duration-400 cursor-pointer", theme.accent)}
                />
              </div>

              <AnimatePresence>
                {ctaClicked && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-center text-[8px] font-mono text-emerald-500 font-semibold -mt-1 mb-1"
                  >
                    ✓ {t("Formulaire ouvert", "Form opened")}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="px-3 pb-3 grid grid-cols-2 gap-1.5">
                {[0, 1].map(j => (
                  <motion.div
                    key={j}
                    whileHover={{ scale: 1.03 }}
                    className="rounded-lg p-2 bg-gray-50 cursor-pointer"
                  >
                    <div className={cn("w-full h-6 rounded mb-1 transition-colors duration-400", theme.accentLight)} />
                    <div className="h-1 w-full rounded-full mb-0.5 bg-gray-200" />
                    <div className="h-1 w-3/4 rounded-full bg-gray-200" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="about"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-5"
            >
              <div className="flex gap-3 items-start">
                <div className={cn("w-10 h-10 rounded-full shrink-0 transition-colors duration-400", theme.accentLight)} />
                <div className="flex-1 space-y-1">
                  <div className="h-2 w-20 rounded-full bg-gray-700" />
                  <div className="h-1 w-full rounded-full bg-gray-200" />
                  <div className="h-1 w-4/5 rounded-full bg-gray-200" />
                  <div className="h-1 w-3/5 rounded-full bg-gray-200" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
