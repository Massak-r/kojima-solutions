import { useLanguage } from "@/hooks/useLanguage";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const Header = () => {
  const { lang, toggle, t } = useLanguage();
  const location = useLocation();
  const isQuoteApp = location.pathname.startsWith("/quotes");
  const isProjectApp = location.pathname.startsWith("/project");

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 glass-card border-t-0 border-x-0 rounded-none"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between h-16">
        {isQuoteApp || isProjectApp ? (
          <Link to="/" className="font-display font-semibold text-lg tracking-tight text-foreground">
            Kojima<span className="text-primary">.</span>Solutions
          </Link>
        ) : (
          <button onClick={() => scrollTo("hero")} className="font-display font-semibold text-lg tracking-tight text-foreground">
            Kojima<span className="text-primary">.</span>Solutions
          </button>
        )}

        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          {isQuoteApp || isProjectApp ? (
            <Link to="/" className="hover:text-foreground transition-colors">
              {t("Accueil", "Home")}
            </Link>
          ) : (
            <>
              <button onClick={() => scrollTo("methodology")} className="hover:text-foreground transition-colors">
                {t("Méthodologie", "Methodology")}
              </button>
              <button onClick={() => scrollTo("services")} className="hover:text-foreground transition-colors">
                {t("Services", "Services")}
              </button>
              <button onClick={() => scrollTo("credits")} className="hover:text-foreground transition-colors">
                {t("Crédits", "Credits")}
              </button>
              <button onClick={() => scrollTo("contact")} className="hover:text-foreground transition-colors">
                Contact
              </button>
            </>
          )}
        </nav>

        <button
          onClick={toggle}
          className="glass-card px-3 py-1.5 text-xs font-medium tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          {lang === "fr" ? "EN" : "FR"}
        </button>
      </div>
    </motion.header>
  );
};

export default Header;
