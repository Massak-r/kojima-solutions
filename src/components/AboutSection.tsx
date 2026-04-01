import { useLanguage } from "@/hooks/useLanguage";
import { motion } from "framer-motion";
import { MapPin, Code2, Video } from "lucide-react";

const AboutSection = () => {
  const { t } = useLanguage();

  return (
    <section id="about" className="section-spacing">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-primary mb-4">
            {t("L'équipe", "The team")}
          </p>
          <h2 className="font-display text-3xl md:text-5xl font-semibold text-gradient-silver">
            {t("Qui sommes-nous ?", "Who are we?")}
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="glass-card-hover p-8 md:p-12 flex flex-col md:flex-row gap-8 items-center"
        >
          {/* Avatar placeholder */}
          <div className="shrink-0">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-5xl select-none border border-primary/20">
              👤
            </div>
          </div>

          {/* Bio */}
          <div className="flex-1">
            <h3 className="font-display text-2xl font-semibold text-foreground mb-1">Massaki</h3>
            <p className="text-sm text-primary font-medium mb-4">Kojima Solutions · Fondateur</p>

            <p className="text-muted-foreground leading-relaxed mb-6">
              {t(
                "Développeur full-stack basé en Suisse, je transforme vos idées en produits digitaux concrets : sites web, applications MVP, et contenus vidéo IA. Mon approche : aller à l'essentiel rapidement, livrer ce qui compte, et construire avec transparence.",
                "Full-stack developer based in Switzerland, I turn your ideas into concrete digital products: websites, MVP apps, and AI video content. My approach: move fast to what matters, deliver what counts, and build with transparency."
              )}
            </p>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary" /> Suisse
              </span>
              <span className="flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-primary" />
                {t("React · TypeScript · PHP", "React · TypeScript · PHP")}
              </span>
              <span className="flex items-center gap-1.5">
                <Video className="w-4 h-4 text-primary" />
                {t("Vidéo IA", "AI Video")}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AboutSection;
