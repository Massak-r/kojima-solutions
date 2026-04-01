import { useEffect, useState } from "react";
import { getAnalytics, type AnalyticsData } from "@/api/analytics";
import { BarChart3, Users, Eye, ArrowRight } from "lucide-react";

export function AnalyticsWidget() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics("7d")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
        <div className="px-5 py-3.5 border-b border-border">
          <div className="h-3 w-24 bg-muted rounded" />
        </div>
        <div className="p-5 space-y-3">
          <div className="h-8 bg-muted rounded" />
          <div className="h-8 bg-muted rounded" />
        </div>
      </section>
    );
  }

  if (!data) return null;

  const todayRow = data.daily.find(
    (d) => d.date === new Date().toISOString().slice(0, 10)
  );
  const todayVisitors = todayRow?.visitors ?? 0;
  const todayPageviews = todayRow?.pageviews ?? 0;

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <BarChart3 size={14} className="text-primary" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Analytics (7j)
        </h2>
      </div>
      <div className="p-5 space-y-4">
        {/* Today stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/40 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Users size={12} />
              <span className="text-[10px] uppercase tracking-wider font-medium">Visiteurs</span>
            </div>
            <p className="font-display text-xl font-bold text-foreground">{todayVisitors}</p>
            <p className="text-[10px] text-muted-foreground">aujourd'hui</p>
          </div>
          <div className="bg-secondary/40 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Eye size={12} />
              <span className="text-[10px] uppercase tracking-wider font-medium">Pages vues</span>
            </div>
            <p className="font-display text-xl font-bold text-foreground">{todayPageviews}</p>
            <p className="text-[10px] text-muted-foreground">aujourd'hui</p>
          </div>
        </div>

        {/* 7d totals */}
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{data.visitors}</span> visiteurs
          {" · "}
          <span className="font-medium text-foreground">{data.pageviews}</span> pages vues
          <span className="text-muted-foreground/60"> (7j)</span>
        </div>

        {/* Funnel */}
        {data.funnelConversion.starts > 0 && (
          <div className="bg-secondary/40 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1">
              Intake funnel
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-foreground">{data.funnelConversion.starts}</span>
              <ArrowRight size={12} className="text-muted-foreground" />
              <span className="font-medium text-foreground">{data.funnelConversion.completes}</span>
              <span className="text-xs text-primary font-semibold ml-auto">
                {data.funnelConversion.rate}%
              </span>
            </div>
          </div>
        )}

        {/* Top pages */}
        {data.topPages.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">
              Top pages
            </p>
            <div className="space-y-1">
              {data.topPages.slice(0, 5).map((p) => (
                <div key={p.path} className="flex items-center justify-between text-xs">
                  <span className="text-foreground truncate max-w-[70%]">
                    {p.path === "/" ? "Accueil" : p.path}
                  </span>
                  <span className="text-muted-foreground font-medium">{p.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top referrers */}
        {data.topReferrers.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">
              Sources
            </p>
            <div className="space-y-1">
              {data.topReferrers.slice(0, 3).map((r) => (
                <div key={r.domain} className="flex items-center justify-between text-xs">
                  <span className="text-foreground truncate max-w-[70%]">{r.domain}</span>
                  <span className="text-muted-foreground font-medium">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
