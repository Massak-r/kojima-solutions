import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Wallet, Banknote, CalendarClock, History, BellRing, Landmark, TrendingUp,
  ClipboardPaste, MoreHorizontal, PiggyBank,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { useIsMobile } from "@/hooks/use-mobile";
import { TresorerieTab } from "@/components/personal/TresorerieTab";
import { BudgetTab } from "@/components/tresorerie/BudgetTab";
import { AccountsManager } from "@/components/tresorerie/AccountsManager";
import { SafeToSpendCard } from "@/components/tresorerie/SafeToSpendCard";
import { PayablesManager } from "@/components/tresorerie/PayablesManager";
import { LedgerView } from "@/components/tresorerie/LedgerView";
import { RenewalsTab } from "@/components/tresorerie/RenewalsTab";
import { CamtReconcile } from "@/components/tresorerie/CamtReconcile";
import { ForecastTab } from "@/components/tresorerie/ForecastTab";
import { BankPasteTab } from "@/components/tresorerie/BankPasteTab";

const TABS = [
  // `short` : le libellé servi sous 640 px. « Prévisionnel » à lui seul mangeait
  // la largeur qui manquait aux trois onglets pour tenir avec le bouton « Plus ».
  { value: "accounts",   label: "Comptes",       icon: Banknote },
  { value: "payables",   label: "À payer",       icon: CalendarClock },
  { value: "forecast",   label: "Prévisionnel",  icon: TrendingUp, short: "Prévu" },
  { value: "ledger",     label: "Historique",    icon: History },
  { value: "budget",     label: "Budget",        icon: PiggyBank },
  { value: "tresorerie", label: "Plans",         icon: Wallet },
  { value: "renewals",   label: "Échéances",     icon: BellRing },
  { value: "reconcile",  label: "Rapprochement", icon: Landmark },
  { value: "bank",       label: "Relevé",        icon: ClipboardPaste },
];

/**
 * Neuf onglets ne tiennent pas sur un téléphone : la barre défilait
 * horizontalement, ce qui cache des sections derrière un geste que personne ne
 * pense à faire. Même remède que la barre de navigation : quatre en vue, le
 * reste dans une feuille. Le desktop, lui, a la place et garde les neuf.
 */
// Trois et non quatre : « Comptes / À payer / Prévisionnel » plus le bouton
// tiennent en 390 px, alors qu'ajouter « Historique » faisait déborder le
// bouton hors de l'écran — le rendant inatteignable, ce qui est pire que tout.
const MOBILE_PRIMARY = ["accounts", "payables", "forecast"];

export default function Tresorerie() {
  const [params] = useSearchParams();
  const initialTab = params.get("tab") ?? "accounts";
  const isMobile = useIsMobile();
  const [tab, setTab] = useState(initialTab);
  const [moreOpen, setMoreOpen] = useState(false);

  const secondary = TABS.filter((t) => !MOBILE_PRIMARY.includes(t.value));
  const shown = isMobile ? TABS.filter((t) => MOBILE_PRIMARY.includes(t.value)) : TABS;
  // Quand la section courante vit derrière « Plus », le bouton prend son nom :
  // sinon la barre donnerait l'impression que rien n'est sélectionné.
  const activeSecondary = isMobile ? secondary.find((t) => t.value === tab) ?? null : null;
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Tr<span className="text-primary">é</span>sorerie
          </h1>
          <p className="text-muted-foreground text-sm font-body mt-1">Comptes, paiements et historique.</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center gap-2 mb-6">
            {/* La zone des onglets peut défiler ; le bouton « Plus », lui, reste
                toujours à l'écran quelle que soit la largeur. */}
            <div className="min-w-0 flex-1 overflow-x-auto scrollbar-hide md:-mx-4 md:px-4 lg:mx-0 lg:px-0">
              <TabsList className="font-body w-max">
                {shown.map(({ value, label, icon: Icon, short }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="text-xs sm:text-sm flex items-center gap-1.5 px-2 sm:px-3"
                  >
                    <Icon size={13} />
                    {short ? (
                      <>
                        <span className="sm:hidden">{short}</span>
                        <span className="hidden sm:inline">{label}</span>
                      </>
                    ) : label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {isMobile && (
              <button
                type="button"
                onClick={() => { haptic("tap"); setMoreOpen(true); }}
                aria-expanded={moreOpen}
                aria-label={`Plus · ${secondary.length} autres sections`}
                className={cn(
                  "shrink-0 max-w-[45%] inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-body font-medium border transition-colors",
                  activeSecondary
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {activeSecondary ? (
                  <>
                    <activeSecondary.icon size={13} className="shrink-0" />
                    {/* « Rapprochement » repoussait les onglets hors de l'écran
                        dès qu'il devenait le libellé du bouton. */}
                    <span className="truncate">{activeSecondary.label}</span>
                  </>
                ) : (
                  <><MoreHorizontal size={14} /> Plus</>
                )}
              </button>
            )}
          </div>

          {/* Feuille « Plus » — les cinq sections restantes, sur mobile */}
          <AnimatePresence>
            {moreOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setMoreOpen(false)}
                  className="fixed inset-0 bg-black/40 z-[60] md:hidden no-print"
                />
                <motion.div
                  role="dialog"
                  aria-label="Autres sections de la trésorerie"
                  initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 420, damping: 38 }}
                  className="fixed bottom-0 left-0 right-0 z-[61] md:hidden rounded-t-3xl bg-card border-t border-border shadow-2xl no-print overflow-hidden"
                  style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
                >
                  <div className="flex justify-center pt-2.5 pb-1">
                    <span className="h-1 w-9 rounded-full bg-border" aria-hidden="true" />
                  </div>
                  <ul className="px-2 pb-3">
                    {secondary.map(({ value, label, icon: Icon }) => {
                      const active = tab === value;
                      return (
                        <li key={value}>
                          <button
                            type="button"
                            onClick={() => { haptic("tap"); setTab(value); setMoreOpen(false); }}
                            className={cn(
                              "w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                              active ? "text-primary bg-primary/10" : "text-foreground hover:bg-secondary/50",
                            )}
                          >
                            <Icon size={18} className="shrink-0" />
                            <span className="text-sm font-medium">{label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              </>
            )}
          </AnimatePresence>
          <TabsContent value="accounts">
            <div className="space-y-6">
              <SafeToSpendCard />
              <AccountsManager />
            </div>
          </TabsContent>
          <TabsContent value="forecast"><ForecastTab /></TabsContent>
          <TabsContent value="payables"><PayablesManager /></TabsContent>
          <TabsContent value="ledger"><LedgerView /></TabsContent>
          <TabsContent value="budget"><BudgetTab /></TabsContent>
          <TabsContent value="tresorerie"><TresorerieTab /></TabsContent>
          <TabsContent value="renewals"><RenewalsTab /></TabsContent>
          <TabsContent value="reconcile"><CamtReconcile /></TabsContent>
          <TabsContent value="bank"><BankPasteTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
