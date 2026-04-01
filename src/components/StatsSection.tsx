import { useLanguage } from "@/hooks/useLanguage";
import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";

function Counter({ to, duration = 1.8 }: { to: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = to / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= to) { setCount(to); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, to, duration]);

  return <span ref={ref}>{count}</span>;
}

const stats = [
  { valueFr: "100", valueEn: "100", labelFr: "CHF / heure", labelEn: "CHF / hour", note: true },
  { value: 15, labelFr: "Projets livrés", labelEn: "Projects delivered" },
  { value: 8,  labelFr: "Clients satisfaits", labelEn: "Happy clients" },
  { value: 3,  labelFr: "Années d'expérience", labelEn: "Years of experience" },
];

const StatsSectionComponent = () => {
  const { t } = useLanguage();

  return (
    <section className="py-16 bg-secondary/20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="text-center"
            >
              <div className="font-display text-4xl md:text-5xl font-bold text-gradient-primary mb-2">
                {'value' in stat ? (
                  <><Counter to={stat.value} />+</>
                ) : (
                  <span>{t(stat.valueFr, stat.valueEn)}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {t(stat.labelFr, stat.labelEn)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSectionComponent;
