import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, CheckCircle2, RotateCcw, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { listNotifications, markRead, markAllRead } from "@/api/notifications";
import type { NotificationItem } from "@/api/notifications";
import { useNavigate } from "react-router-dom";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}j`;
}

function notifIcon(item: NotificationItem): { icon: React.ReactNode; border: string } {
  const text = ((item.taskTitle || "") + " " + (item.response || "")).toLowerCase();
  if (/approuv|validé|accepté/.test(text)) return { icon: <CheckCircle2 size={14} className="text-emerald-500" />, border: "border-l-emerald-400" };
  if (/révis|modif|correction/.test(text)) return { icon: <RotateCcw size={14} className="text-amber-500" />, border: "border-l-amber-400" };
  return { icon: <MessageSquare size={14} className="text-primary" />, border: "border-l-primary" };
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await listNotifications(false, 20);
      setItems(res.items);
      setUnreadCount(res.unreadCount);

      // Update app badge if supported
      if ("setAppBadge" in navigator) {
        if (res.unreadCount > 0) {
          (navigator as any).setAppBadge(res.unreadCount);
        } else {
          (navigator as any).clearAppBadge();
        }
      }
    } catch {
      // API not available yet — silently ignore
    }
  }, []);

  // Fetch on mount + poll every 60s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.read) {
      await markRead(item.id).catch(() => {});
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (item.projectId) navigate(`/project/${item.projectId}/feedback`);
  };

  const handleMarkAllRead = async () => {
    await markAllRead().catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    if ("clearAppBadge" in navigator) (navigator as any).clearAppBadge();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] flex items-center justify-center text-[9px] font-bold text-white bg-destructive rounded-full leading-none px-1"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 glass-card rounded-xl border border-border shadow-xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <span className="font-display text-sm font-semibold text-foreground">
                Notifications
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:underline font-body"
                >
                  Tout marquer lu
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-border/30">
              {items.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground font-body">
                  Aucune notification
                </div>
              ) : (
                items.slice(0, 15).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`w-full text-left px-4 py-3 hover:bg-secondary/30 transition-colors border-l-2 ${
                      !item.read ? `bg-primary/[0.03] ${notifIcon(item).border}` : "border-l-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="shrink-0 mt-0.5">{notifIcon(item).icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-body font-semibold text-foreground">
                          {item.projectTitle}
                        </p>
                        <p className="text-[11px] font-body text-muted-foreground mt-0.5">
                          <span className="font-medium">{item.clientName}</span>
                          {item.taskTitle && ` · ${item.taskTitle}`}
                        </p>
                        {item.response && (
                          <p className="text-[11px] font-body text-muted-foreground/70 mt-0.5 line-clamp-2">
                            {item.response}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground/50 font-body shrink-0 mt-0.5">
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
