import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ExternalLink } from "lucide-react";
import { listNotifications } from "@/api/notifications";
import type { NotificationItem } from "@/api/notifications";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString("fr-CH", { day: "numeric", month: "short" });
}

export function RecentActivity() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listNotifications(false, 10);
        if (!cancelled) setItems(res.items);
      } catch {
        // API not available
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
        <Bell size={15} className="text-primary" />
        <h2 className="font-display text-sm font-semibold text-foreground">Activité récente</h2>
      </div>
      <div className="divide-y divide-border/50">
        {items.slice(0, 8).map((item) => (
          <button
            key={item.id}
            onClick={() => item.projectId && navigate(`/project/${item.projectId}/feedback`)}
            className="w-full text-left px-5 py-3 hover:bg-secondary/30 transition-colors flex items-start gap-3"
          >
            <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${item.read ? "bg-border" : "bg-primary"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-body font-medium text-foreground">
                {item.clientName}
                <span className="text-muted-foreground font-normal"> sur </span>
                {item.projectTitle}
              </p>
              {item.response && (
                <p className="text-[11px] font-body text-muted-foreground/70 mt-0.5 line-clamp-1">
                  {item.response}
                </p>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground/50 font-body shrink-0">
              {timeAgo(item.createdAt)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
