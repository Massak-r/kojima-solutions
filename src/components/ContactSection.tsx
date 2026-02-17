import { useLanguage } from "@/hooks/useLanguage";
import { motion } from "framer-motion";
import { useState } from "react";
import { Mail } from "lucide-react";

const ContactSection = () => {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Nouveau projet – ${name}`);
    const body = encodeURIComponent(`Nom: ${name}\nEmail: ${email}\n\n${message}`);
    window.location.href = `mailto:massaki@kojima-solutions.ch?subject=${subject}&body=${body}`;
  };

  return (
    <section id="contact" className="section-spacing bg-secondary/30">
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
          <h2 className="font-display text-3xl md:text-5xl font-semibold text-gradient-silver mb-4">
            {t("Parlons de votre projet", "Let's talk about your project")}
          </h2>
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" /> massaki@kojima-solutions.ch
          </p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="glass-card p-8 space-y-6"
        >
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
              placeholder="email@exemple.ch"
            />
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
              placeholder={t("Décrivez votre projet…", "Describe your project…")}
            />
          </div>
          <button
            type="submit"
            className="w-full py-4 bg-primary text-primary-foreground font-display font-medium rounded-lg btn-primary-glow transition-all duration-300 hover:scale-[1.02]"
          >
            {t("Envoyer", "Send")}
          </button>
        </motion.form>
      </div>
    </section>
  );
};

export default ContactSection;
