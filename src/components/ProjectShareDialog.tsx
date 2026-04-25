import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, User2, Users, Share2, Unlink, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { shareProject, unshareProject } from "@/api/stakeholder";
import type { StoredProject } from "@/contexts/ProjectsContext";

interface ProjectShareDialogProps {
  project: StoredProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShareTokenChange: (projectId: string, token: string | null) => void;
}

export function ProjectShareDialog({
  project,
  open,
  onOpenChange,
  onShareTokenChange,
}: ProjectShareDialogProps) {
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const clientSlug = project.clientSlug || project.id;
  const clientUrl = `${origin}/client/${clientSlug}`;
  const stakeholderUrl = project.shareToken
    ? `${origin}/project/s/${project.shareToken}`
    : null;

  function markCopied(key: string) {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1800);
  }

  async function copy(url: string, label: string, key: string) {
    try {
      await navigator.clipboard.writeText(url);
      markCopied(key);
      toast({ title: `${label} copié` });
    } catch {
      toast({ title: "Erreur de copie", variant: "destructive" });
    }
  }

  async function createStakeholderLink() {
    setBusy(true);
    try {
      const token = await shareProject(project.id);
      onShareTokenChange(project.id, token);
      const url = `${origin}/project/s/${token}`;
      await navigator.clipboard.writeText(url);
      markCopied("stakeholder");
      toast({ title: "Lien stakeholder créé et copié" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function revokeStakeholderLink() {
    const ok = window.confirm(
      "Révoquer le lien stakeholder ? Les personnes avec l'ancien lien ne pourront plus accéder au projet.",
    );
    if (!ok) return;
    setBusy(true);
    try {
      await unshareProject(project.id);
      onShareTokenChange(project.id, null);
      toast({ title: "Lien stakeholder révoqué" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function copyAll() {
    const urls = [
      `Portail client : ${clientUrl}`,
      stakeholderUrl ? `Vue stakeholder : ${stakeholderUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(urls);
      markCopied("all");
      toast({ title: "Tous les liens copiés" });
    } catch {
      toast({ title: "Erreur de copie", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 size={16} className="text-primary" />
            Partage du projet
          </DialogTitle>
          <DialogDescription>
            Un seul endroit pour tous les liens de partage et qui voit quoi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <ShareRow
            icon={<User2 size={14} />}
            title="Portail client"
            subtitle="Vue client : timeline, livrables, demandes de validation"
            url={clientUrl}
            active
            onCopy={() => copy(clientUrl, "Lien portail client", "client")}
            copied={copiedKey === "client"}
          />

          <ShareRow
            icon={<Users size={14} />}
            title="Vue stakeholder"
            subtitle="Lecture seule pour partenaires / décideurs externes"
            url={stakeholderUrl}
            active={!!stakeholderUrl}
            onCopy={
              stakeholderUrl
                ? () => copy(stakeholderUrl, "Lien stakeholder", "stakeholder")
                : undefined
            }
            copied={copiedKey === "stakeholder"}
            action={
              stakeholderUrl ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={revokeStakeholderLink}
                  disabled={busy}
                  className="h-7 px-2 text-[10px] gap-1 text-destructive hover:bg-destructive/10"
                >
                  <Unlink size={11} />
                  Révoquer
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={createStakeholderLink}
                  disabled={busy}
                  className="h-7 px-2 text-[10px] gap-1"
                >
                  <Plus size={11} />
                  Créer
                </Button>
              )
            }
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground/60 font-body">
            Les liens client et stakeholder sont séparés volontairement.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={copyAll}
            className="h-8 gap-1.5 text-xs"
          >
            {copiedKey === "all" ? (
              <Check size={12} className="text-emerald-500" />
            ) : (
              <Copy size={12} />
            )}
            Copier tout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShareRow({
  icon,
  title,
  subtitle,
  url,
  active,
  onCopy,
  copied,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  url: string | null;
  active: boolean;
  onCopy?: () => void;
  copied?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 space-y-2",
        active
          ? "border-border bg-card"
          : "border-dashed border-border/50 bg-muted/20",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
            active
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground/50",
          )}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-body font-semibold text-foreground">
              {title}
            </span>
            {!active && (
              <span className="text-[9px] font-body font-semibold uppercase tracking-wider text-muted-foreground/60">
                Non activé
              </span>
            )}
          </div>
          <p className="text-[11px] font-body text-muted-foreground/70 mt-0.5">
            {subtitle}
          </p>
        </div>
        {action}
      </div>

      {url && onCopy && (
        <div className="flex items-center gap-1.5">
          <code className="flex-1 min-w-0 text-[10px] font-mono text-muted-foreground/80 bg-muted/40 rounded-md px-2 py-1.5 truncate">
            {url}
          </code>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCopy}
            className="h-7 w-7 p-0 shrink-0"
            title="Copier"
            aria-label="Copier le lien"
          >
            {copied ? (
              <Check size={12} className="text-emerald-500" />
            ) : (
              <Copy size={12} />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
