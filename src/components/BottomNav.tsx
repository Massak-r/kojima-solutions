import { useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  FileText,
  FolderOpen,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnyFocusSessionActive } from "@/hooks/useAnyFocusSession";
import { useAdminDocs } from "@/hooks/useAdminDocs";

const BOTTOM_NAV = [
  { to: "/home",       label: "Accueil",    icon: LayoutDashboard },
  { to: "/sprint",     label: "Sprint",     icon: Target          },
  { to: "/quotes",     label: "Devis",      icon: FileText        },
  { to: "/accounting", label: "Finance",    icon: TrendingUp      },
  { to: "/tresorerie", label: "Trésorerie", icon: Wallet          },
  { to: "/documents",  label: "Documents",  icon: FolderOpen      },
];

const ADMIN_PREFIXES = [
  "/home", "/space", "/sprint", "/projects", "/project/", "/quotes", "/quote/",
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

  if (!isAdminPage) return null;

  return (
    <>
      {/* ── Mobile bottom nav ── */}
      <nav
        aria-label="Navigation principale"
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-card border-b-0 border-x-0 rounded-none no-print"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around h-16">
          {BOTTOM_NAV.map(({ to, label, icon: Icon }) => {
            const active =
              pathname === to ||
              (to === "/home" && pathname.startsWith("/project/")) ||
              (to === "/quotes" && pathname.startsWith("/quote"));
            const showBadge = to === "/sprint" && sprintActive;
            const docCount = to === "/documents" ? pendingCount : 0;
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                aria-label={
                  showBadge ? `${label} · session en cours`
                  : docCount > 0 ? `${label} · ${docCount} à trier`
                  : label
                }
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors ${
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
                  <NavCountBadge count={docCount} />
                </div>
                <span className="text-[10px] font-medium leading-tight">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Desktop sidebar nav ── */}
      <nav aria-label="Navigation latérale" className="hidden md:flex fixed top-16 left-0 bottom-0 z-40 w-16 flex-col items-center py-4 gap-1 bg-card/80 backdrop-blur-lg border-r border-border no-print">
        {BOTTOM_NAV.map(({ to, label, icon: Icon }) => {
          const active =
            pathname === to ||
            (to === "/home" && pathname.startsWith("/project/")) ||
            (to === "/quotes" && pathname.startsWith("/quote"));
          const showBadge = to === "/sprint" && sprintActive;
          const docCount = to === "/documents" ? pendingCount : 0;
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              aria-label={
                sprintActive && to === "/sprint" ? `${label} · session en cours`
                : docCount > 0 ? `${label} · ${docCount} à trier`
                : label
              }
              className={`relative flex flex-col items-center justify-center gap-0.5 w-14 py-2.5 rounded-lg transition-colors ${
                active
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title={sprintActive && to === "/sprint" ? `${label} · session en cours` : label}
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
                <NavCountBadge count={docCount} />
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
