import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Archive, FileText } from "lucide-react";
import { RegistreTab } from "@/components/admin/RegistreTab";
import { DocumentsTab } from "@/components/adminSpace/DocumentsTab";

export default function AdminSpace() {
  const [activeTab, setActiveTab] = useState('registre');
  const [defaultFolder, setDefaultFolder] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-12 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Documents <span className="text-primary">&amp;</span> Registre
          </h1>
          <p className="text-muted-foreground text-sm font-body mt-1">
            Gestion documentaire et registre administratif.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={v => { if (v !== 'documents') setDefaultFolder(null); setActiveTab(v); }} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="registre" className="font-body gap-1.5">
              <Archive size={14} /> Registre
            </TabsTrigger>
            <TabsTrigger value="documents" className="font-body gap-1.5">
              <FileText size={14} /> Documents
            </TabsTrigger>
          </TabsList>
          <TabsContent value="registre">
            <RegistreTab onOpenFolder={(fid) => { setDefaultFolder(fid); setActiveTab('documents'); }} />
          </TabsContent>
          <TabsContent value="documents"><DocumentsTab defaultFolder={defaultFolder} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
