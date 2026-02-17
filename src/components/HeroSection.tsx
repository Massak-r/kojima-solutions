import { useLanguage } from "@/hooks/useLanguage";
import { motion } from "framer-motion";
import heroBg from "@/assets/hero-bg.jpg";

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={heroBg} alt="" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-6"
        >
          Kojima Solutions · Suisse
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold leading-tight text-gradient-silver mb-8"
        >
          {t(
            "L'artisanat numérique au service de votre vision.",
            "Digital Craftsmanship for your vision."
          )}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.7 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12"
        >
          {t(
            "1ère heure de conseil offerte pour définir votre trajectoire.",
            "First hour of consulting offered to define your trajectory."
          )}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.7 }}
        >
          <a
            href="#contact"
            className="inline-block px-8 py-4 bg-primary text-primary-foreground font-display font-medium rounded-lg btn-primary-glow transition-all duration-300 hover:scale-105"
          >
            {t(
              "Votre premier café est offert – Discutons de votre projet",
              "Your first coffee is on us – Let's discuss your project"
            )}
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="w-5 h-8 border border-muted-foreground/30 rounded-full flex justify-center">
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
            className="w-1 h-2 bg-muted-foreground/50 rounded-full mt-1.5"
          />
        </div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
