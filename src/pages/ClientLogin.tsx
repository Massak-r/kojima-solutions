import { useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { clientLogin, type ClientLoginProject } from "@/api/clientLogin";
import { setClientAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User, Loader2, FolderOpen, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, { fr: string; en: string; class: string }> = {
  draft:         { fr: "Brouillon",  en: "Draft",       class: "bg-muted text-muted-foreground" },
  "in-progress": { fr: "En cours",   en: "In Progress", class: "bg-blue-100 text-blue-700" },
  completed:     { fr: "Terminé",    en: "Completed",   class: "bg-emerald-100 text-emerald-700" },
  "on-hold":     { fr: "En pause",   en: "On Hold",     class: "bg-amber-100 text-amber-700" },
};

const ClientLogin = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    client: { id: string; name: string; organization?: string };
    projects: ClientLoginProject[];
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await clientLogin(email.trim());
      setResult(data);
      // Pre-authorize all projects for this email
      for (const p of data.projects) {
        setClientAuth(p.id, email.trim());
      }
    } catch {
      setError(t("Aucun projet trouvé pour cet email.", "No projects found for this email."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
            <User size={22} className="text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t("Espace client", "Client Portal")}
          </h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            {t(
              "Entrez votre email pour accéder à vos projets",
              "Enter your email to access your projects"
            )}
          </p>
        </div>

        {!result ? (
          <form
            onSubmit={handleSubmit}
            className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4"
          >
            <Input
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              className="font-body"
              autoFocus
              required
            />
            {error && (
              <p className="font-body text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full font-body" disabled={loading}>
              {loading && <Loader2 size={16} className="mr-2 animate-spin" />}
              {t("Accéder", "Access")}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="font-body text-sm text-muted-foreground mb-1">
                {t("Bienvenue", "Welcome")}
              </p>
              <p className="font-display text-lg font-bold text-foreground">
                {result.client.name}
              </p>
              {result.client.organization && (
                <p className="font-body text-xs text-muted-foreground">
                  {result.client.organization}
                </p>
              )}
            </div>

            <div className="space-y-2">
              {result.projects.map((p) => {
                const slug = p.clientSlug || p.id;
                const status = STATUS_LABELS[p.status] ?? STATUS_LABELS.draft;
                return (
                  <a
                    key={p.id}
                    href={`/client/${slug}`}
                    className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FolderOpen size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm font-semibold text-foreground truncate">
                        {p.title}
                      </p>
                      <span className={cn("inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1", status.class)}>
                        {t(status.fr, status.en)}
                      </span>
                    </div>
                    <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientLogin;
