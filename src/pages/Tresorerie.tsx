import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Banknote, CalendarClock, History, BellRing, Landmark, TrendingUp, ClipboardPaste } from "lucide-react";
import { TresorerieTab } from "@/components/personal/TresorerieTab";
import { BudgetTab } from "@/components/tresorerie/BudgetTab";
import { AccountsManager } from "@/components/tresorerie/AccountsManager";
import { SafeToSpendCard } from "@/components/tresorerie/SafeToSpendCard";
import { PayablesManager } from "@/components/tresorerie/PayablesManager";
import { LedgerView } from "@/components/tresorerie/LedgerView";
import { RenewalsTab } from "@/components/tresorerie/RenewalsTab";
import { CamtReconcile } from "@/components/tresorerie/CamtReconcile";
import { ForecastTab } from "@/components/tresorerie/ForecastTab";
import { BankPasteTab } from "@/components/tresorerie/BankPasteTab";

export default function Tresorerie() {
  const [params] = useSearchParams();
  const initialTab = params.get("tab") ?? "accounts";
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Tr<span className="text-primary">é</span>sorerie
          </h1>
          <p className="text-muted-foreground text-sm font-body mt-1">Comptes, paiements et historique.</p>
        </div>

        <Tabs defaultValue={initialTab}>
          <div className="overflow-x-auto mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="font-body w-max">
              <TabsTrigger value="accounts" className="text-xs sm:text-sm flex items-center gap-1.5">
                <Banknote size={13} /> Comptes
              </TabsTrigger>
              <TabsTrigger value="forecast" className="text-xs sm:text-sm flex items-center gap-1.5">
                <TrendingUp size={13} /> Prévisionnel
              </TabsTrigger>
              <TabsTrigger value="payables" className="text-xs sm:text-sm flex items-center gap-1.5">
                <CalendarClock size={13} /> À payer
              </TabsTrigger>
              <TabsTrigger value="ledger" className="text-xs sm:text-sm flex items-center gap-1.5">
                <History size={13} /> Historique
              </TabsTrigger>
              <TabsTrigger value="budget" className="text-xs sm:text-sm">Budget</TabsTrigger>
              <TabsTrigger value="tresorerie" className="text-xs sm:text-sm flex items-center gap-1.5">
                <Wallet size={13} /> Plans
              </TabsTrigger>
              <TabsTrigger value="renewals" className="text-xs sm:text-sm flex items-center gap-1.5">
                <BellRing size={13} /> Échéances
              </TabsTrigger>
              <TabsTrigger value="reconcile" className="text-xs sm:text-sm flex items-center gap-1.5">
                <Landmark size={13} /> Rapprochement
              </TabsTrigger>
              <TabsTrigger value="bank" className="text-xs sm:text-sm flex items-center gap-1.5">
                <ClipboardPaste size={13} /> Relevé
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="accounts">
            <div className="space-y-6">
              <SafeToSpendCard />
              <AccountsManager />
            </div>
          </TabsContent>
          <TabsContent value="forecast"><ForecastTab /></TabsContent>
          <TabsContent value="payables"><PayablesManager /></TabsContent>
          <TabsContent value="ledger"><LedgerView /></TabsContent>
          <TabsContent value="budget"><BudgetTab /></TabsContent>
          <TabsContent value="tresorerie"><TresorerieTab /></TabsContent>
          <TabsContent value="renewals"><RenewalsTab /></TabsContent>
          <TabsContent value="reconcile"><CamtReconcile /></TabsContent>
          <TabsContent value="bank"><BankPasteTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
