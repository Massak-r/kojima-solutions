import { useLanguage } from "@/hooks/useLanguage";
import { motion } from "framer-motion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    nameFr: "Marc D.",
    nameEn: "Marc D.",
    org: "PME industrielle",
    textFr: "Kojima a transformé notre processus interne avec un outil sur mesure. Simple, rapide, efficace. Exactement ce qu'il nous fallait.",
    textEn: "Kojima transformed our internal process with a custom tool. Simple, fast, effective. Exactly what we needed.",
  },
  {
    nameFr: "Sophie L.",
    nameEn: "Sophie L.",
    org: "Studio créatif",
    textFr: "Le système de crédits est transparent et flexible. On sait toujours où on en est, et la qualité est au rendez-vous à chaque livraison.",
    textEn: "The credit system is transparent and flexible. We always know where we stand, and the quality is there with every delivery.",
  },
  {
    nameFr: "Thomas R.",
    nameEn: "Thomas R.",
    org: "Startup fintech",
    textFr: "De l'idée au MVP en 3 semaines. L'accompagnement était clair, structuré, et le résultat dépasse nos attentes.",
    textEn: "From idea to MVP in 3 weeks. The support was clear, structured, and the result exceeded our expectations.",
  },
];

const TestimonialsSection = () => {
  const { t } = useLanguage();

  return (
    <section className="section-spacing">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-primary mb-4">
            {t("Témoignages", "Testimonials")}
          </p>
          <h2 className="font-display text-3xl md:text-5xl font-semibold text-gradient-silver">
            {t("Ce qu'ils en disent", "What they say")}
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <Carousel
            opts={{ align: "center", loop: true }}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {TESTIMONIALS.map((item, i) => (
                <CarouselItem key={i} className="pl-4 md:basis-4/5 lg:basis-3/4">
                  <div className="glass-card p-8 md:p-10 relative">
                    <Quote
                      size={32}
                      className="text-primary/15 absolute top-6 left-6"
                    />
                    <p className="font-body text-base md:text-lg text-foreground/80 leading-relaxed mb-6 relative z-10">
                      "{t(item.textFr, item.textEn)}"
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-display font-bold text-primary text-sm">
                          {(t(item.nameFr, item.nameEn)).charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-display font-semibold text-sm text-foreground">
                          {t(item.nameFr, item.nameEn)}
                        </p>
                        <p className="font-body text-xs text-muted-foreground">
                          {item.org}
                        </p>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex -left-4" />
            <CarouselNext className="hidden md:flex -right-4" />
          </Carousel>
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
