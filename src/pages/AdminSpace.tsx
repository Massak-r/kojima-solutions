import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive, FileText, ScanLine } from "lucide-react";
import { RegistreTab } from "@/components/admin/RegistreTab";
import { DocumentsTab } from "@/components/adminSpace/DocumentsTab";
import { TriageTab } from "@/components/adminSpace/TriageTab";
import { PendingDocsBanner } from "@/components/PendingDocsBanner";
import { useAdminDocs } from "@/hooks/useAdminDocs";

type AdminTab = "triage" | "documents" | "registre";

export default function AdminSpace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("tab");
  const initialTab: AdminTab =
    param === "documents" ? "documents" :
    param === "registre" ? "registre" :
    "triage";

  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [defaultFolder, setDefaultFolder] = useState<string | null>(null);
  const { pendingCount } = useAdminDocs();

  function changeTab(value: string) {
    const tab = value as AdminTab;
    if (tab !== "documents") setDefaultFolder(null);
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-12 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Documents <span className="text-primary">&amp;</span> Registre
          </h1>
          <p className="text-muted-foreground text-sm font-body mt-1">
            Scanne, trie et archive tes documents administratifs.
          </p>
        </div>

        <PendingDocsBanner className="mb-6" />

        <Tabs value={activeTab} onValueChange={changeTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="triage" className="font-body gap-1.5">
              <ScanLine size={14} /> À trier
              {pendingCount > 0 && (
                <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold inline-flex items-center justify-center leading-none">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="documents" className="font-body gap-1.5">
              <FileText size={14} /> Documents
            </TabsTrigger>
            <TabsTrigger value="registre" className="font-body gap-1.5">
              <Archive size={14} /> Registre
            </TabsTrigger>
          </TabsList>
          <TabsContent value="triage"><TriageTab /></TabsContent>
          <TabsContent value="documents"><DocumentsTab defaultFolder={defaultFolder} /></TabsContent>
          <TabsContent value="registre">
            <RegistreTab onOpenFolder={(fid) => { setDefaultFolder(fid); changeTab("documents"); }} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
