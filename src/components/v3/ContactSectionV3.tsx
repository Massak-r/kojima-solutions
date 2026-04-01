import { useLanguage } from "@/hooks/useLanguage";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { motion } from "framer-motion";
import { useState } from "react";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const EU = "massaki";
const EH = "kojima-solutions.ch";

const ContactSectionV3 = () => {
  const { t } = useLanguage();
  const ref = useScrollReveal<HTMLElement>();
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const TOPICS = [
    { key: "new", fr: "Nouveau projet", en: "New project", prefillFr: "Bonjour, j'aimerais discuter d'un nouveau projet. ", prefillEn: "Hello, I'd like to discuss a new project. " },
    { key: "quote", fr: "Demande de devis", en: "Quote request", prefillFr: "Bonjour, j'aimerais obtenir un devis pour ", prefillEn: "Hello, I'd like to get a quote for " },
    { key: "tech", fr: "Question technique", en: "Technical question", prefillFr: "Bonjour, j'ai une question technique concernant ", prefillEn: "Hello, I have a technical question about " },
    { key: "other", fr: "Autre", en: "Other", prefillFr: "", prefillEn: "" },
  ];

  function selectTopic(key: string) {
    const topic = TOPICS.find(tp => tp.key === key)!;
    setActiveTopic(key);
    setMessage(t(topic.prefillFr, topic.prefillEn));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Honeypot: if filled, silently pretend success (bot caught)
    if (honeypot) {
      setSuccess(true);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/contact.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, _hp: honeypot }),
      });
      if (!res.ok) throw new Error("server");
      setSuccess(true);
      window.plausible?.("Contact Submit");
      setName(""); setEmail(""); setMessage("");
    } catch {
      setError(t(
        "Une erreur est survenue. Réessayez ou écrivez-nous directement par email.",
        "Something went wrong. Please try again or email us directly."
      ));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section ref={ref} data-reveal id="contact" className="section-spacing bg-secondary/30">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-primary mb-4">
            Contact
          </p>
          {/* ✨ Animated gradient text on contact title */}
          <h2 className="font-display text-3xl md:text-5xl font-semibold text-gradient-animated mb-4">
            {t("Parlons de votre projet", "Let's talk about your project")}
          </h2>
          <a
            href={`mailto:${EU}@${EH}`}
            className="text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4" />
            <span>{EU}&#64;{EH}</span>
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="glass-card p-8"
        >
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-palette-sage/20 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-palette-sage" />
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-foreground mb-1">
                  {t("Message envoyé !", "Message sent!")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("Nous revenons vers vous sous 24h.", "We'll get back to you within 24h.")}
                </p>
              </div>
              <a
                href="/intake"
                className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {t("Estimer mon projet gratuitement →", "Get a free project estimate →")}
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  {t("Nom", "Name")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  placeholder={t("Votre nom", "Your name")}
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  placeholder="email@example.com"
                />
              </div>
              {/* Honeypot — hidden from real users, bots will fill it */}
              <div className="absolute opacity-0 pointer-events-none h-0 overflow-hidden" aria-hidden="true" tabIndex={-1}>
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  autoComplete="off"
                  tabIndex={-1}
                />
              </div>
              {/* Topic chips */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  {t("Sujet", "Topic")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {TOPICS.map(topic => (
                    <motion.button
                      key={topic.key}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => selectTopic(topic.key)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all duration-200 border",
                        activeTopic === topic.key
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground",
                      )}
                    >
                      {t(topic.fr, topic.en)}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={4}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
                  placeholder={t("Décrivez votre projet...", "Describe your project...")}
                />
              </div>
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
              {/* ✨ Send button with animated gradient border */}
              <div className="relative p-[2px] rounded-lg overflow-hidden">
                <span
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background:
                      "conic-gradient(from var(--angle), hsl(215 45% 30%), hsl(145 20% 44%), hsl(258 28% 48%), hsl(215 45% 30%))",
                    animation: "rotate-gradient 3s linear infinite",
                  }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="relative w-full py-4 bg-primary text-primary-foreground font-display font-medium rounded-[6px] transition-all duration-300 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? t("Envoi en cours...", "Sending...") : t("Envoyer", "Send")}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default ContactSectionV3;
