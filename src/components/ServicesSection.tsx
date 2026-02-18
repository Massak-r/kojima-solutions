import { useLanguage } from "@/hooks/useLanguage";
import { motion } from "framer-motion";
import { Globe, Smartphone, Video, HeadphonesIcon } from "lucide-react";

const services = [
  {
    icon: Globe,
    titleFr: "Création de Sites Web",
    titleEn: "Website Creation",
    descFr: "Adaptatifs, designs épurés. Des sites qui incarnent l'identité de votre marque.",
    descEn: "Adaptive, clean designs. Websites that embody your brand identity.",
  },
  {
    icon: Smartphone,
    titleFr: "Prototypes d'Apps (MVP)",
    titleEn: "App Prototypes (MVP)",
    descFr: "Nous transformons votre idée en une application fonctionnelle en un temps record. Notre approche privilégie l'essentiel : nous construisons d'abord les fonctionnalités critiques pour valider votre projet avant d'utiliser le budget sur les nice-to-have.",
    descEn: "We turn your idea into a working application in record time. Our approach focuses on the essentials: building critical features first to validate your project before spending the budget on nice-to-haves.",
  },
  {
    icon: Video,
    titleFr: "Vidéo IA & Montage",
    titleEn: "AI Video & Editing",
    descFr: "Contenu vidéo haute performance généré par IA pour une communication moderne et percutante.",
    descEn: "High-performance AI-generated video content for modern, impactful communication.",
  },
  {
    icon: HeadphonesIcon,
    titleFr: "Conseil & Accompagnement",
    titleEn: "Consulting & Support",
    descFr: "Stratégie vidéo et optimisation de vos processus internes pour maximiser votre efficacité digitale.",
    descEn: "Video strategy and internal process optimization to maximize your digital efficiency.",
  },
];

const ServicesSection = () => {
  const { t } = useLanguage();

  return (
    <section id="services" className="section-spacing bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-primary mb-4">
            {t("Ce que nous faisons", "What we do")}
          </p>
          <h2 className="font-display text-3xl md:text-5xl font-semibold text-gradient-silver">
            {t("Nos services", "Our services")}
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {services.map((service, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              className="glass-card-hover p-8 group"
            >
              <div className="w-12 h-12 mb-6 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-500">
                <service.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                {t(service.titleFr, service.titleEn)}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(service.descFr, service.descEn)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
