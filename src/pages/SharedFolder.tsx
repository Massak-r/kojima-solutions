import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { FileText, Folder, FolderOpen, ChevronRight, Home, Loader2, ShieldAlert, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchSharedFolder, getDocViewUrl, getFolderZipUrl, type SharedFolderData } from "@/api/adminDocs";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
  return (bytes / 1024 / 1024).toFixed(1) + " Mo";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SharedFolder() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedFolderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError(true); setLoading(false); return; }
    fetchSharedFolder(token)
      .then(d => { setData(d); setCurrentFolderId(d.folder.id); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  const subFolders = useMemo(() => {
    if (!data) return [];
    return data.subFolders.filter(f => f.parentId === currentFolderId).sort((a, b) => a.name.localeCompare(b.name));
  }, [data, currentFolderId]);

  const docs = useMemo(() => {
    if (!data) return [];
    return data.docs.filter(d => d.folderId === currentFolderId);
  }, [data, currentFolderId]);

  // Build breadcrumb from root folder
  function getBreadcrumb(): { id: string; name: string }[] {
    if (!data) return [];
    const path: { id: string; name: string }[] = [];
    let cur: string | null = currentFolderId;
    while (cur && cur !== data.folder.id) {
      const f = data.subFolders.find(x => x.id === cur);
      if (!f) break;
      path.unshift({ id: f.id, name: f.name });
      cur = f.parentId;
    }
    return path;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm">
          <ShieldAlert size={48} className="mx-auto mb-4 text-muted-foreground/40" />
          <h1 className="font-display text-xl font-semibold mb-2">Lien invalide</h1>
          <p className="text-sm text-muted-foreground font-body">Ce dossier n'existe pas ou le lien a expiré.</p>
        </div>
      </div>
    );
  }

  const breadcrumb = getBreadcrumb();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary mb-1 font-body">Dossier partagé</p>
            <h1 className="font-display text-2xl font-semibold">{data.folder.name}</h1>
          </div>
          {data.docs.length > 0 && (
            <a href={getFolderZipUrl(token!)} className="shrink-0">
              <Button variant="outline" className="gap-2 text-sm">
                <Download size={14} />
                Tout télécharger
              </Button>
            </a>
          )}
        </div>

        {/* Breadcrumb */}
        {(currentFolderId !== data.folder.id || breadcrumb.length > 0) && (
          <div className="flex items-center gap-1 text-sm font-body text-muted-foreground flex-wrap mb-5">
            <button onClick={() => setCurrentFolderId(data.folder.id)} className="hover:text-primary transition-colors flex items-center gap-1">
              <Home size={13} /> {data.folder.name}
            </button>
            {breadcrumb.map(f => (
              <span key={f.id} className="flex items-center gap-1">
                <ChevronRight size={12} className="opacity-40" />
                <button onClick={() => setCurrentFolderId(f.id)} className="hover:text-primary transition-colors">
                  {f.name}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Subfolders */}
        {subFolders.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-5">
            {subFolders.map(f => (
              <button
                key={f.id}
                onClick={() => setCurrentFolderId(f.id)}
                className="glass-card rounded-xl p-3 flex items-center gap-3 hover:ring-1 hover:ring-primary/30 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Folder size={16} className="text-primary" />
                </div>
                <span className="font-body text-sm font-medium truncate">{f.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Documents */}
        {docs.length > 0 ? (
          <div className="space-y-2">
            {docs.map(doc => (
              <a
                key={doc.id}
                href={getDocViewUrl(doc.filename)}
                target="_blank"
                rel="noreferrer"
                className="glass-card rounded-2xl p-4 flex items-center gap-4 group hover:ring-1 hover:ring-primary/30 transition-all block"
              >
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-destructive/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body font-medium text-sm truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-body flex-wrap">
                    <Badge variant="secondary" className="text-xs">{doc.category}</Badge>
                    {doc.year && <Badge variant="outline" className="text-xs">{doc.year}</Badge>}
                    <span>{formatBytes(doc.fileSize)}</span>
                    <span>·</span>
                    <span>{formatDate(doc.createdAt)}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : subFolders.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-body">Ce dossier est vide.</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground font-body">
            Kojima Solutions
          </p>
        </div>
      </div>
    </div>
  );
}
