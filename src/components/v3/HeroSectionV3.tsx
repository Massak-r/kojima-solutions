import { useLanguage } from "@/hooks/useLanguage";
import { motion, useScroll, useTransform } from "framer-motion";
import heroBg from "@/assets/hero-bg.jpg";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { LiveStatusCard } from "@/components/home/LiveStatusCard";

// Always French cycling words (brand identity)
const CYCLING_WORDS = ['sites web', 'web apps', 'outils internes'];

function CyclingText({ words }: { words: string[] }) {
  const [idx,     setIdx]     = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeOut = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(fadeOut);
  }, [idx]);

  useEffect(() => {
    if (!visible) {
      const next = setTimeout(() => {
        setIdx(i => (i + 1) % words.length);
        setVisible(true);
      }, 350);
      return () => clearTimeout(next);
    }
  }, [visible, words.length]);

  return (
    <span
      className={cn(
        'inline-block transition-all duration-300 text-primary font-semibold',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
      )}
    >
      {words[idx]}
    </span>
  );
}

const HeroSectionV3 = () => {
  const { t } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll-linked parallax for the background
  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 600], [0, 180]);

  return (
    <section ref={sectionRef} id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background with float animation + parallax */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.img
          src={heroBg}
          alt=""
          className="w-full h-full object-cover opacity-40 hero-bg-float"
          style={{ y: bgY }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Cycling text */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="text-base md:text-lg text-muted-foreground mb-4 font-body"
        >
          {t('Nous créons des ', 'We build ')}<CyclingText words={CYCLING_WORDS} />
        </motion.p>

        {/* Animated gradient text */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold leading-tight text-gradient-animated mb-8"
        >
          {t(
            "La première étape de votre vision.",
            "The first step of your vision."
          )}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.7 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12"
        >
          {t(
            "La première séance est offerte.",
            "The first session is on us."
          )}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.7 }}
        >
          <motion.a
            href="/intake"
            whileTap={{ scale: 0.97 }}
            className="inline-block px-8 py-4 bg-primary text-primary-foreground font-display font-medium rounded-lg btn-primary-glow transition-all duration-300 hover:scale-105"
          >
            {t(
              "Estimer mon projet gratuitement",
              "Get a free project estimate"
            )}
          </motion.a>
          <a
            href="#contact"
            className="block mt-4 text-sm text-muted-foreground hover:text-primary transition-colors font-body"
          >
            {t(
              "ou contactez-nous directement →",
              "or contact us directly →"
            )}
          </a>
        </motion.div>
      </div>

      {/* Live Status Card */}
      <LiveStatusCard />

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

export default HeroSectionV3;
