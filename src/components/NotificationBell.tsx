import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, CheckCircle2, RotateCcw, MessageSquare, Mail, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  listNotifications, markRead, markAllRead, dismissNotification, clearAllNotifications,
} from "@/api/notifications";
import type { NotificationItem } from "@/api/notifications";
import { listQueuedEmails, discardQueuedEmail } from "@/api/emailQueue";
import type { QueuedEmail } from "@/api/emailQueue";
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

/** Reflect a count on the PWA app icon when the platform supports it. */
function setBadge(n: number) {
  if (!("setAppBadge" in navigator)) return;
  try {
    if (n > 0) (navigator as any).setAppBadge(n);
    else (navigator as any).clearAppBadge();
  } catch { /* ignore */ }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingEmails, setPendingEmails] = useState<QueuedEmail[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await listNotifications(false, 20);
      setItems(res.items);
      setUnreadCount(res.unreadCount);
      setBadge(res.unreadCount);
    } catch {
      // API not available yet — silently ignore
    }
  }, []);

  const fetchPendingEmails = useCallback(async () => {
    try {
      setPendingEmails(await listQueuedEmails("pending"));
    } catch {
      // queue endpoint optional — silently ignore
    }
  }, []);

  // Fetch on mount + poll every 60s
  useEffect(() => {
    fetchNotifications();
    fetchPendingEmails();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchPendingEmails();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications, fetchPendingEmails]);

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
      setUnreadCount((c) => { const next = Math.max(0, c - 1); setBadge(next); return next; });
    }
    setOpen(false);
    if (item.projectId) navigate(`/project/${item.projectId}/feedback`);
  };

  const handleMarkAllRead = async () => {
    await markAllRead().catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    setBadge(0);
  };

  // Remove a single notification from the bell AND the DB (not just mark read).
  // Optimistic — the row leaves immediately; the request reconciles in the back.
  const handleDismiss = async (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((n) => n.id !== item.id));
    if (!item.read) setUnreadCount((c) => { const next = Math.max(0, c - 1); setBadge(next); return next; });
    await dismissNotification(item.id).catch(() => {});
  };

  // Clear every notification at once — the "clean slate" the bell was missing.
  const handleClearAll = async () => {
    setItems([]);
    setUnreadCount(0);
    setBadge(0);
    await clearAllNotifications().catch(() => {});
  };

  // Dismiss the pending-email reminder without leaving the bell. Emails are sent
  // manually here, so "Ignorer" simply discards the queued draft(s).
  const handleDismissEmails = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ids = pendingEmails.map((em) => em.id);
    setPendingEmails([]);
    await Promise.all(ids.map((id) => discardQueuedEmail(id).catch(() => {})));
  };

  // Badge combines unread notifications + pending emails so the bell reflects
  // everything that needs admin attention from any page.
  const pendingCount = pendingEmails.length;
  const totalBadge = unreadCount + pendingCount;
  const ariaLabel = totalBadge > 0
    ? `Notifications (${unreadCount} non lue${unreadCount > 1 ? "s" : ""}, ${pendingCount} email${pendingCount > 1 ? "s" : ""} en attente)`
    : "Notifications";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        title="Notifications"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={18} />
        {totalBadge > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] flex items-center justify-center text-[9px] font-bold text-white bg-destructive rounded-full leading-none px-1"
          >
            {totalBadge > 99 ? "99+" : totalBadge}
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
            className="absolute right-0 top-full mt-2 w-[calc(100vw-1rem)] max-w-sm sm:w-96 sm:max-w-none glass-card bg-popover rounded-xl border border-border shadow-xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <span className="font-display text-sm font-semibold text-foreground">
                Notifications
              </span>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-primary hover:underline font-body"
                  >
                    Tout lire
                  </button>
                )}
                {items.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-muted-foreground hover:text-destructive hover:underline font-body"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>

            {/* Pending emails — only shown when there are queued sends. The body
                links to where EmailQueue lives; the X discards them inline
                (emails are sent manually, so the queue is just a reminder). */}
            {pendingCount > 0 && (
              <div className="flex items-stretch border-b border-border/30 bg-amber-50/40 dark:bg-amber-500/5">
                <button
                  onClick={() => { setOpen(false); navigate("/home?tab=overview"); }}
                  className="flex-1 min-w-0 flex items-center gap-2.5 px-4 py-2.5 hover:bg-secondary/30 transition-colors text-left"
                >
                  <Mail size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-body font-semibold text-foreground">
                      {pendingCount} email{pendingCount > 1 ? "s" : ""} en attente
                    </p>
                    <p className="text-[10px] font-body text-muted-foreground/70">
                      Revoir + envoyer manuellement
                    </p>
                  </div>
                  <ChevronRight size={12} className="text-muted-foreground/40 shrink-0" />
                </button>
                <button
                  onClick={handleDismissEmails}
                  title="Ignorer"
                  aria-label="Ignorer les emails en attente"
                  className="px-3 flex items-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5 transition-colors border-l border-border/30"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-border/30">
              {items.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground font-body">
                  Aucune notification
                </div>
              ) : (
                items.slice(0, 15).map((item) => (
                  <div
                    key={item.id}
                    className={`group flex items-stretch border-l-2 ${
                      !item.read ? `bg-primary/[0.03] ${notifIcon(item).border}` : "border-l-transparent"
                    }`}
                  >
                    <button
                      onClick={() => handleItemClick(item)}
                      className="flex-1 min-w-0 text-left px-4 py-3 hover:bg-secondary/30 transition-colors"
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
                    <button
                      onClick={(e) => handleDismiss(e, item)}
                      title="Retirer"
                      aria-label="Retirer la notification"
                      className="px-2.5 flex items-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/5 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
