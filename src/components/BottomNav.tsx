import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  FileText,
  Sun,
  Gauge,
  BellRing,
  Handshake,
  ShieldCheck,
  MoreHorizontal,
} from "lucide-react";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { useAnyFocusSessionActive } from "@/hooks/useAnyFocusSession";
import { useAdminDocs } from "@/hooks/useAdminDocs";
import { useInboxCount } from "@/hooks/useInboxCount";

// « Aujourd'hui » ouvre le plan du jour (/jour) en premier — la surface
// on-the-go. /sprint (vue planification profonde) reste accessible via le
// bouton « Planifier » du plan, plus depuis la nav.
const BOTTOM_NAV = [
  { to: "/jour",       label: "Aujourd'hui", icon: Sun            },
  { to: "/home",       label: "Accueil",    icon: LayoutDashboard },
  { to: "/cockpit",    label: "Pilotage",   icon: Gauge           },
  { to: "/relances",   label: "Relances",   icon: BellRing        },
  { to: "/pipeline",   label: "Leads",      icon: Handshake       },
  { to: "/quotes",     label: "Devis",      icon: FileText        },
  { to: "/accounting", label: "Finance",    icon: TrendingUp      },
  { to: "/tresorerie", label: "Trésorerie", icon: Wallet          },
  { to: "/documents",  label: "Admin",      icon: ShieldCheck     },
];

/**
 * Mobile keeps four destinations plus « Plus ». Nine tabs did not fit, so the
 * bar scrolled sideways — which hides items behind a gesture nobody thinks to
 * make, and is the single thing that made this read as a website rather than an
 * app. Nothing is removed: the other five live one tap away, and the desktop
 * sidebar still lists all nine.
 */
const MOBILE_PRIMARY = ["/jour", "/home", "/tresorerie", "/documents"];

const ADMIN_PREFIXES = [
  "/home", "/jour", "/cockpit", "/relances", "/pipeline", "/space", "/sprint", "/projects", "/project/", "/quotes", "/quote/",
  "/clients", "/accounting", "/tresorerie", "/documents", "/settings",
  "/objective/",
];

export function useIsAdminPage() {
  const { pathname } = useLocation();
  // Print preview routes (e.g. /quotes/:id/print, /funnel/:id/print) are
  // public-facing previews that auto-trigger window.print() — must not be
  // treated as admin chrome surfaces, otherwise floating buttons leak into
  // the printed output and the on-screen preview.
  if (pathname.endsWith("/print")) return false;
  return ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
}

/** True on the client portal dashboard (`/client/:id`), which renders its own
 *  full-bleed branded masthead — so the global header and its top padding stand
 *  down there (no double Kojima logo). Excludes `/client/login` and the
 *  sub-routes (proposal / decision / feedback), which keep the global header. */
export function useIsClientDashboard() {
  const { pathname } = useLocation();
  const seg = pathname.split("/").filter(Boolean);
  return seg.length === 2 && seg[0] === "client" && seg[1] !== "login";
}

/** Shared so the bar, the « Plus » sheet and the sidebar can never disagree. */
function isActive(to: string, pathname: string): boolean {
  return (
    pathname === to ||
    (to === "/jour" && pathname.startsWith("/sprint")) ||
    (to === "/home" && pathname.startsWith("/project/")) ||
    (to === "/quotes" && pathname.startsWith("/quote"))
  );
}

/** Small red count badge for the Documents nav item — pending scans to sort. */
function NavCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function BottomNav() {
  const { pathname } = useLocation();
  const isAdminPage = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  const sprintActive = useAnyFocusSessionActive();
  const { pendingCount } = useAdminDocs({ enabled: isAdminPage });
  const { pendingCount: inboxCount } = useInboxCount({ enabled: isAdminPage });
  const [moreOpen, setMoreOpen] = useState(false);

  const badgeFor = (to: string) =>
    to === "/documents" ? pendingCount : to === "/home" ? inboxCount : 0;

  const primaryItems = MOBILE_PRIMARY
    .map((to) => BOTTOM_NAV.find((n) => n.to === to))
    .filter((n): n is (typeof BOTTOM_NAV)[number] => !!n);
  const secondaryItems = BOTTOM_NAV.filter((n) => !MOBILE_PRIMARY.includes(n.to));
  // Highlight « Plus » when the page you are on lives behind it, so the bar
  // never looks like nothing is selected.
  const secondaryActive = secondaryItems.some((n) => isActive(n.to, pathname));

  if (!isAdminPage) return null;

  return (
    <>
      {/* ── Mobile bottom nav — 4 destinations + « Plus » ── */}
      <nav
        aria-label="Navigation principale"
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-card border-b-0 border-x-0 rounded-none no-print"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="grid grid-cols-5 items-center h-16 px-1">
          {primaryItems.map(({ to, label, icon: Icon }) => {
            const active = isActive(to, pathname);
            const showBadge = to === "/jour" && sprintActive;
            const badgeCount = badgeFor(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => haptic("tap")}
                aria-current={active ? "page" : undefined}
                aria-label={
                  showBadge ? `${label} · session en cours`
                  : badgeCount > 0 ? `${label} · ${badgeCount} à trier`
                  : label
                }
                className={`relative flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="bottom-nav-pill"
                    className="absolute -top-0.5 w-8 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <div className="relative">
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.5} />
                  {showBadge && (
                    <span className={cn(
                      "absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-500",
                      "before:absolute before:inset-0 before:rounded-full before:bg-emerald-500 before:animate-ping before:opacity-70"
                    )} />
                  )}
                  <NavCountBadge count={badgeCount} />
                </div>
                <span className="text-[10px] font-medium leading-tight">{label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => { haptic("tap"); setMoreOpen(true); }}
            aria-expanded={moreOpen}
            aria-label={`Plus · ${secondaryItems.length} autres sections`}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
              secondaryActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <div className="relative">
              <MoreHorizontal size={20} strokeWidth={secondaryActive ? 2.2 : 1.5} />
            </div>
            <span className="text-[10px] font-medium leading-tight">Plus</span>
          </button>
        </div>
      </nav>

      {/* ── Feuille « Plus » — les cinq sections restantes ── */}
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
              aria-label="Autres sections"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              className="fixed bottom-0 left-0 right-0 z-[61] md:hidden rounded-t-3xl bg-card border-t border-border shadow-2xl no-print overflow-hidden"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <div className="flex justify-center pt-2.5 pb-1">
                <span className="h-1 w-9 rounded-full bg-border" aria-hidden="true" />
              </div>
              <ul className="px-2 pb-3">
                {secondaryItems.map(({ to, label, icon: Icon }) => {
                  const active = isActive(to, pathname);
                  return (
                    <li key={to}>
                      <Link
                        to={to}
                        onClick={() => { haptic("tap"); setMoreOpen(false); }}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
                          active ? "text-primary bg-primary/10" : "text-foreground hover:bg-secondary/50"
                        }`}
                      >
                        <Icon size={18} strokeWidth={active ? 2.2 : 1.6} className="shrink-0" />
                        <span className="text-sm font-medium">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop sidebar nav ── */}
      <nav aria-label="Navigation latérale" className="hidden md:flex fixed top-16 left-0 bottom-0 z-40 w-16 flex-col items-center py-4 gap-1 bg-card/80 backdrop-blur-lg border-r border-border no-print">
        {BOTTOM_NAV.map(({ to, label, icon: Icon }) => {
          const active = isActive(to, pathname);
          const showBadge = to === "/jour" && sprintActive;
          const badgeCount = badgeFor(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              aria-label={
                showBadge ? `${label} · session en cours`
                : badgeCount > 0 ? `${label} · ${badgeCount} à trier`
                : label
              }
              className={`relative flex flex-col items-center justify-center gap-0.5 w-14 py-2.5 rounded-lg transition-colors ${
                active
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title={showBadge ? `${label} · session en cours` : label}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-nav-pill"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <div className="relative">
                <Icon size={18} strokeWidth={active ? 2.2 : 1.5} />
                {showBadge && (
                  <span className={cn(
                    "absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-500",
                    "before:absolute before:inset-0 before:rounded-full before:bg-emerald-500 before:animate-ping before:opacity-70"
                  )} />
                )}
                <NavCountBadge count={badgeCount} />
              </div>
              <span className="text-[9px] font-medium leading-tight">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
