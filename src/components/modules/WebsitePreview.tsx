import type { SelectedModule } from "@/types/module";
import { ModulePreviewBand } from "./PreviewBlocks";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, Search, Server, MessageCircle } from "lucide-react";

// Render order matches a real website layout
const SECTION_ORDER = [
  "blog", "gallery", "ecommerce", "map",           // content
  "dashboard", "booking", "contact-form",           // interaction mid
  "newsletter", "client-portal", "backend-admin",   // interaction/system
  "auth", "payment",                                // system/commerce
];

interface Props {
  modules: SelectedModule[];
}

export function WebsitePreview({ modules }: Props) {
  const activeIds = new Set(modules.map((m) => m.moduleId));

  const sectionModules = SECTION_ORDER
    .filter((id) => activeIds.has(id))
    .map((id) => ({ id, complexity: modules.find((m) => m.moduleId === id)!.complexity }));

  const hasI18n = activeIds.has("i18n");
  const hasSeo = activeIds.has("seo");
  const hasHosting = activeIds.has("hosting");
  const hasChat = activeIds.has("chat");

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden bg-white shadow-sm">
      {/* Nav bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50/90 border-gray-100">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-indigo-500" />
          <div className="h-1.5 w-10 rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center gap-1.5">
          {["Accueil", "Pages"].map((p) => (
            <div key={p} className="px-1.5 py-0.5 rounded text-[9px] font-mono text-gray-400">{p}</div>
          ))}
          <AnimatePresence>
            {hasI18n && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100"
              >
                <Globe size={10} className="text-indigo-500" />
                <span className="text-[8px] font-bold text-indigo-600">FR</span>
                <span className="text-[8px] text-gray-400">EN</span>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {hasSeo && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100"
              >
                <Search size={8} className="text-emerald-500" />
                <span className="text-[8px] font-bold text-emerald-600">SEO</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Hero section (always visible) */}
      <div className="px-4 py-4 text-center">
        <div className="h-1.5 w-20 mx-auto rounded-full mb-1.5 bg-gray-200" />
        <div className="h-2.5 w-28 mx-auto rounded-full mb-2.5 bg-gray-700" />
        <div className="h-5 w-20 mx-auto rounded-md bg-indigo-400" />
      </div>

      {/* Module sections — labeled bands */}
      <AnimatePresence>
        {sectionModules.map(({ id, complexity }) => (
          <ModulePreviewBand key={id} moduleId={id} complexity={complexity} />
        ))}
      </AnimatePresence>

      {/* Footer */}
      <div className="px-3 py-2.5 bg-gray-50/70 border-t border-gray-100 relative">
        <div className="flex gap-4">
          <div className="space-y-0.5">
            <div className="h-[1px] w-8 bg-gray-200" />
            <div className="h-[1px] w-6 bg-gray-200" />
          </div>
          <div className="space-y-0.5">
            <div className="h-[1px] w-6 bg-gray-200" />
            <div className="h-[1px] w-8 bg-gray-200" />
          </div>
        </div>
        <AnimatePresence>
          {hasHosting && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute right-2 bottom-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-100"
            >
              <Server size={8} className="text-blue-500" />
              <span className="text-[8px] font-medium text-blue-600">Hosted</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat bubble overlay */}
      <AnimatePresence>
        {hasChat && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="w-7 h-7 rounded-full bg-indigo-500 shadow-lg flex items-center justify-center"
            style={{ position: "relative", float: "right", marginTop: -20, marginRight: 8, marginBottom: 4 }}
          >
            <MessageCircle size={14} className="text-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
