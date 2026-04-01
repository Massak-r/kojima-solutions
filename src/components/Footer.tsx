import { useLanguage } from "@/hooks/useLanguage";

const EU = "massaki";
const EH = "kojima-solutions.ch";

const NAV_LINKS = [
  { id: "methodology", fr: "Méthodologie", en: "Methodology" },
  { id: "services",    fr: "Services",     en: "Services"    },
  { id: "credits",     fr: "Tarifs",       en: "Pricing"     },
  { id: "faq",         fr: "FAQ",          en: "FAQ"         },
  { id: "contact",     fr: "Contact",      en: "Contact"     },
];

const Footer = () => {
  const { t } = useLanguage();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="py-12 px-6 border-t border-border bg-secondary/10">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">

          {/* Brand */}
          <div>
            <p className="font-display font-semibold text-lg text-foreground mb-2">
              Kojima<span className="text-primary">.</span>Solutions
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(
                "Développement web & IA · Suisse",
                "Web development & AI · Switzerland"
              )}
            </p>
          </div>

          {/* Nav */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              {t("Navigation", "Navigation")}
            </p>
            <div className="flex flex-col gap-2">
              {NAV_LINKS.map(link => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                >
                  {t(link.fr, link.en)}
                </button>
              ))}
              <a
                href="/portfolio"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                {t("Réalisations", "Portfolio")}
              </a>
              <a
                href="/intake"
                className="text-sm text-primary hover:text-primary/80 transition-colors text-left font-medium"
              >
                {t("Estimer mon projet gratuitement", "Get a free estimate")}
              </a>
              <a
                href="/client/login"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                {t("Espace client", "Client Portal")}
              </a>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Contact
            </p>
            <a
              href={`mailto:${EU}@${EH}`}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {EU}&#64;{EH}
            </a>
            <p className="text-sm text-muted-foreground mt-2">
              {t("Suisse 🇨🇭", "Switzerland 🇨🇭")}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-3">
              {t("Session de cadrage offerte · Sans engagement", "Free scoping session · No commitment")}
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-border/40 text-center">
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} Kojima Solutions ·{" "}
            {t("Tous droits réservés", "All rights reserved")}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
