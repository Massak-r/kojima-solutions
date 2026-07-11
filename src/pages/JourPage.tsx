import { AujourdhuiTab } from "@/components/home/AujourdhuiTab";
import { MondayBriefDialog, useMondayBriefAutoOpen } from "@/components/home/MondayBriefDialog";
import { formatDateWithWeekday } from "@/lib/dateFormat";

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
        {/* Le top bar mobile titre déjà « Aujourd'hui » — ici, la date suffit. */}
        <header className="mb-4 px-1">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground leading-tight first-letter:uppercase">
            {formatDateWithWeekday(new Date())}
          </h1>
        </header>
        <AujourdhuiTab />
      </main>
      <MondayBriefDialog open={mondayBriefOpen} onOpenChange={setMondayBriefOpen} />
    </div>
  );
}
