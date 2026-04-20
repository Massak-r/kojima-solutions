import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CloudOff, Lock, LogOut, Menu, MoreVertical, Settings, Shield, X, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./NotificationBell";
import { getQueueSize } from "@/lib/offlineQueue";

const HOME_NAV = [
  { id: "methodology", fr: "Méthodologie", en: "Methodology" },
  { id: "services",    fr: "Services",     en: "Services"    },
  { id: "credits",     fr: "Tarifs",       en: "Pricing"     },
  { id: "faq",         fr: "FAQ",          en: "FAQ"         },
  { id: "contact",     fr: "Contact",      en: "Contact"     },
];

const Header = () => {
  const { lang, toggle, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, logoutAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);
  const [offlineQueueSize, setOfflineQueueSize] = useState(getQueueSize());

  // Listen for offline queue changes
  useEffect(() => {
    const handler = (e: Event) => setOfflineQueueSize((e as CustomEvent).detail ?? getQueueSize());
    window.addEventListener("offline-queue-change", handler);
    return () => window.removeEventListener("offline-queue-change", handler);
  }, []);

  const isHome       = location.pathname === "/";
  const isClientPage = location.pathname.startsWith("/client/");
  const isLoginPage  = location.pathname === "/login";
  const isAdminPage  = !isHome && !isClientPage && !isLoginPage;

  // Scroll-aware header glass intensity
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close overflow menu on route change
  useEffect(() => {
    setOverflowOpen(false);
  }, [location.pathname]);

  // Close overflow when clicking outside
  useEffect(() => {
    if (!overflowOpen) return;
    const handler = () => setOverflowOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [overflowOpen]);

  // Track active section on homepage via IntersectionObserver
  useEffect(() => {
    if (!isHome) return;
    const sectionIds = HOME_NAV.map(n => n.id);
    const visible = new Set<string>();
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
          setActiveSection(sectionIds.find(s => visible.has(s)) ?? "");
        },
        { threshold: 0.25 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, [isHome]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };

  function handleLogout() {
    logoutAdmin();
    setMobileOpen(false);
    navigate("/");
  }

  // Mobile page title for admin pages
  const PAGE_TITLES: Record<string, string> = {
    "/space": "Kojima Space",
    "/sprint": "Sprint",
    "/projects": "Projets",
    "/quotes": "Devis",
    "/clients": "Clients",
    "/accounting": "Finance",
    "/tresorerie": "Trésorerie",
    "/documents": "Documents",
    "/settings": "Réglages",
  };
  const mobileTitle = isAdminPage
    ? PAGE_TITLES[location.pathname] ??
      (location.pathname.startsWith("/project/") ? "Projet" :
       location.pathname.startsWith("/quote") ? "Devis" : "Kojima Space")
    : null;

  function isActive(to: string) {
    return (
      location.pathname === to ||
      (to !== "/space" &&
        to !== "/accounting" &&
        to !== "/tresorerie" &&
        to !== "/documents" &&
        to !== "/settings" &&
        location.pathname.startsWith(
          to.replace("/quotes", "/quote").replace("/projects", "/project")
        ))
    );
  }

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 glass-card border-t-0 border-x-0 rounded-none no-print transition-all duration-300",
          scrolled && "shadow-md backdrop-blur-2xl",
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 flex items-center justify-between h-16">
          {/* Logo — on mobile admin pages, show current page title */}
          {isHome ? (
            <button onClick={() => scrollTo("hero")} className="font-display font-semibold text-lg tracking-tight text-foreground">
              Kojima<span className="text-primary">.</span>Solutions
            </button>
          ) : (
            <>
              <Link to="/" className="hidden md:block font-display font-semibold text-lg tracking-tight text-foreground">
                Kojima<span className="text-primary">.</span>Solutions
              </Link>
              {mobileTitle ? (
                <span className="md:hidden font-display font-semibold text-base tracking-tight text-foreground">
                  {mobileTitle}
                </span>
              ) : (
                <Link to="/" className="md:hidden font-display font-semibold text-lg tracking-tight text-foreground">
                  Kojima<span className="text-primary">.</span>Solutions
                </Link>
              )}
            </>
          )}

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            {isHome ? (
              <div className="flex items-center gap-5 lg:gap-7">
                {HOME_NAV.map(nav => (
                  <button
                    key={nav.id}
                    onClick={() => scrollTo(nav.id)}
                    className={`transition-colors text-sm ${
                      activeSection === nav.id
                        ? "text-foreground font-medium"
                        : "hover:text-foreground"
                    }`}
                  >
                    {t(nav.fr, nav.en)}
                  </button>
                ))}
              </div>
            ) : isAdminPage ? (
              <div className="flex items-center gap-0.5">
                <NotificationBell />
                {offlineQueueSize > 0 && (
                  <span
                    className="ml-1 flex items-center gap-1 text-[10px] font-body text-amber-700 bg-amber-100/80 rounded-full px-2 py-0.5"
                    title={`${offlineQueueSize} action(s) en attente de synchronisation`}
                  >
                    <CloudOff size={10} />
                    {offlineQueueSize}
                  </span>
                )}
                <Link
                  to="/settings"
                  className="ml-1 flex items-center gap-1.5 text-muted-foreground/50 hover:text-foreground transition-colors text-xs px-2 py-1.5 rounded-lg hover:bg-secondary"
                  title="Réglages"
                >
                  <Settings size={13} />
                </Link>
                <button
                  onClick={() => navigate("/")}
                  className="ml-1 flex items-center gap-1.5 text-muted-foreground/60 hover:text-foreground transition-colors text-xs"
                >
                  <ArrowLeft size={13} />
                  {t("Site", "Site")}
                </button>
                {isAdmin && (
                  <button
                    onClick={handleLogout}
                    className="ml-1 flex items-center gap-1.5 text-muted-foreground/50 hover:text-destructive transition-colors text-xs px-2 py-1.5 rounded-lg hover:bg-destructive/10"
                    title="Logout"
                  >
                    <LogOut size={13} />
                    Logout
                  </button>
                )}
              </div>
            ) : null}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isHome && (
              <Link
                to="/login"
                className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-all"
                title="Admin login"
              >
                <Lock size={14} />
              </Link>
            )}
            <button
              onClick={toggle}
              className="glass-card px-3 py-1.5 text-xs font-medium tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              {lang === "fr" ? "EN" : "FR"}
            </button>

            {/* Mobile hamburger — homepage only (admin uses bottom nav) */}
            {isHome && (
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                aria-label="Menu"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}

            {/* Mobile notification bell — admin pages */}
            {isAdminPage && (
              <div className="md:hidden">
                <NotificationBell />
              </div>
            )}

            {/* Mobile overflow menu — admin pages only (secondary actions) */}
            {isAdminPage && (
              <div className="relative md:hidden">
                <button
                  onClick={(e) => { e.stopPropagation(); setOverflowOpen((v) => !v); }}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                  aria-label="Plus"
                >
                  <MoreVertical size={18} />
                </button>
                <AnimatePresence>
                  {overflowOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-1 w-40 glass-card border border-border rounded-xl shadow-lg overflow-hidden z-50"
                    >
                      <Link
                        to="/documents"
                        onClick={() => setOverflowOpen(false)}
                        className={`flex items-center gap-2.5 px-4 py-3 text-sm transition-colors ${
                          location.pathname === "/documents"
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        <Shield size={15} />
                        Documents
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setOverflowOpen(false)}
                        className={`flex items-center gap-2.5 px-4 py-3 text-sm transition-colors border-t border-border ${
                          location.pathname === "/settings"
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        <Settings size={15} />
                        Réglages
                      </Link>
                      <button
                        onClick={() => { setOverflowOpen(false); navigate("/"); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors border-t border-border"
                      >
                        <ArrowLeft size={15} />
                        Site
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => { setOverflowOpen(false); handleLogout(); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border-t border-border"
                        >
                          <LogOut size={15} />
                          Logout
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.header>

      {/* Mobile dropdown menu */}
      <AnimatePresence>
        {mobileOpen && isHome && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed top-16 left-0 right-0 z-40 md:hidden glass-card border-t border-border shadow-lg no-print"
          >
            <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
              {HOME_NAV.map(nav => (
                <button
                  key={nav.id}
                  onClick={() => scrollTo(nav.id)}
                  className={`px-4 py-3 rounded-xl text-sm font-body text-left transition-colors ${
                    activeSection === nav.id
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {t(nav.fr, nav.en)}
                </button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
