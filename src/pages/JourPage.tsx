import { AujourdhuiTab } from "@/components/home/AujourdhuiTab";
import { MondayBriefDialog, useMondayBriefAutoOpen } from "@/components/home/MondayBriefDialog";
import { DayHero } from "@/components/home/DayHero";

/**
 * « Aujourd'hui » — la page d'atterrissage mobile / PWA. Zéro chrome entre
 * l'ouverture de l'app et le plan du jour : une ligne de date et le plan,
 * pour savoir quoi faire tout de suite et pouvoir planifier en route.
 * L'Accueil garde son onglet Aujourd'hui pour le rituel desktop.
 */
export default function JourPage() {
  const [mondayBriefOpen, setMondayBriefOpen] = useMondayBriefAutoOpen();
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-24">
        {/* L'ouverture de la journée : salutation, date et l'anneau du jour.
            La date seule ne donnait aucun point d'accroche au regard. */}
        <DayHero />
        <AujourdhuiTab showPlanHeadline={false} />
      </main>
      <MondayBriefDialog open={mondayBriefOpen} onOpenChange={setMondayBriefOpen} />
    </div>
  );
}
