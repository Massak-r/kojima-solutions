import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet } from "lucide-react";
import { TresorerieTab } from "@/components/personal/TresorerieTab";
import { BudgetTab } from "@/components/tresorerie/BudgetTab";

export default function Tresorerie() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Tr<span className="text-primary">é</span>sorerie
          </h1>
          <p className="text-muted-foreground text-sm font-body mt-1">Budget et trésorerie.</p>
        </div>

        <Tabs defaultValue="budget">
          <div className="overflow-x-auto mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="font-body w-max">
              <TabsTrigger value="budget" className="text-xs sm:text-sm">Budget</TabsTrigger>
              <TabsTrigger value="tresorerie" className="text-xs sm:text-sm flex items-center gap-1.5">
                <Wallet size={13} /> Trésorerie
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="budget"><BudgetTab /></TabsContent>
          <TabsContent value="tresorerie"><TresorerieTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
