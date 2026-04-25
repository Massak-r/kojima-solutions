import { useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  TrendingUp,
  Wallet,
  FileText,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnyFocusSessionActive } from "@/hooks/useAnyFocusSession";

const BOTTOM_NAV = [
  { to: "/space",      label: "Espace",     icon: LayoutDashboard },
  { to: "/sprint",     label: "Sprint",     icon: Target          },
  { to: "/projects",   label: "Projets",    icon: FolderKanban    },
  { to: "/accounting", label: "Finance",    icon: TrendingUp      },
  { to: "/tresorerie", label: "Trésorerie", icon: Wallet          },
  { to: "/documents",  label: "Documents",  icon: FileText        },
];

const ADMIN_PREFIXES = [
  "/space", "/sprint", "/projects", "/project/", "/quotes", "/quote/",
  "/clients", "/accounting", "/tresorerie", "/documents", "/settings",
  "/objective/",
];

export function useIsAdminPage() {
  const { pathname } = useLocation();
  return ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
}

export default function BottomNav() {
  const { pathname } = useLocation();
  const isAdminPage = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  const sprintActive = useAnyFocusSessionActive();

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
              (to === "/projects" && pathname.startsWith("/project/")) ||
              (to === "/quotes" && pathname.startsWith("/quote"));
            const showBadge = to === "/sprint" && sprintActive;
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                aria-label={showBadge ? `${label} · session en cours` : label}
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
            (to === "/projects" && pathname.startsWith("/project/")) ||
            (to === "/quotes" && pathname.startsWith("/quote"));
          const showBadge = to === "/sprint" && sprintActive;
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              aria-label={sprintActive && to === "/sprint" ? `${label} · session en cours` : label}
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
