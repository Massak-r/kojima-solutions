import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, Loader2, ChevronDown, Check, X, Clock, DollarSign, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  listChangeOrders, createChangeOrder, updateChangeOrder, deleteChangeOrder,
  type ChangeOrder, type ChangeOrderStatus, type FunnelGate,
} from "@/api/funnels";

const STATUS_STYLES: Record<ChangeOrderStatus, { label: string; className: string }> = {
  proposed: { label: "Proposé",  className: "bg-amber-100 text-amber-700" },
  accepted: { label: "Accepté",  className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Refusé",   className: "bg-red-100 text-red-600" },
};

interface Props {
  funnelId: string;
  gates: FunnelGate[];
}

export function ChangeOrderManager({ funnelId, gates }: Props) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [costImpact, setCostImpact] = useState("");
  const [timeImpact, setTimeImpact] = useState("");
  const [gateId, setGateId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const data = await listChangeOrders(funnelId);
      setOrders(data);
    } catch {} finally {
      setLoading(false);
    }
  }, [funnelId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Summaries
  const acceptedOrders = orders.filter((o) => o.status === "accepted");
  const totalCostImpact = acceptedOrders.reduce((s, o) => s + (o.costImpact ?? 0), 0);
  const totalTimeImpact = acceptedOrders.reduce((s, o) => s + (o.timeImpactDays ?? 0), 0);
  const pendingCount = orders.filter((o) => o.status === "proposed").length;

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createChangeOrder({
        funnelId,
        gateId: gateId || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        costImpact: costImpact ? parseFloat(costImpact) : undefined,
        timeImpactDays: timeImpact ? parseInt(timeImpact) : undefined,
      });
      setTitle(""); setDescription(""); setCostImpact(""); setTimeImpact(""); setGateId("");
      setAdding(false);
      fetch();
      toast({ title: "Change order créé" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(id: string, status: ChangeOrderStatus) {
    try {
      await updateChangeOrder(id, { status });
      fetch();
      toast({ title: `Change order ${status === "accepted" ? "accepté" : "refusé"}` });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteChangeOrder(id);
      setOrders(orders.filter((o) => o.id !== id));
      setDeletingId(null);
      toast({ title: "Supprimé" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-secondary/20 transition-colors"
      >
        <AlertTriangle size={14} className="text-amber-500" />
        <span className="flex-1 font-display text-sm font-semibold text-foreground/80">
          Change Orders
        </span>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700">
            {pendingCount} en attente
          </Badge>
        )}
        {!loading && (
          <span className="text-[10px] text-muted-foreground/40 font-body">
            {orders.length} total
          </span>
        )}
        <ChevronDown size={14} className={cn("text-muted-foreground/30 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30">
          {/* Impact summary */}
          {acceptedOrders.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-3 text-xs font-body">
              {totalCostImpact !== 0 && (
                <span className={cn("flex items-center gap-1", totalCostImpact > 0 ? "text-red-600" : "text-emerald-600")}>
                  <DollarSign size={11} />
                  {totalCostImpact > 0 ? "+" : ""}{totalCostImpact.toLocaleString("fr-CH")} CHF
                </span>
              )}
              {totalTimeImpact !== 0 && (
                <span className={cn("flex items-center gap-1", totalTimeImpact > 0 ? "text-red-600" : "text-emerald-600")}>
                  <Clock size={11} />
                  {totalTimeImpact > 0 ? "+" : ""}{totalTimeImpact} jour{Math.abs(totalTimeImpact) !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* Orders list */}
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin text-muted-foreground/30" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-xs text-muted-foreground/30 font-body py-2 text-center">Aucun change order.</p>
          ) : (
            <div className="space-y-2 pt-2">
              {orders.map((order) => {
                const status = STATUS_STYLES[order.status];
                const gateName = gates.find((g) => g.id === order.gateId)?.title;

                return (
                  <div key={order.id} className="flex items-start gap-2 bg-secondary/10 rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-body font-medium text-foreground/80">{order.title}</span>
                        <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0 shrink-0", status.className)}>
                          {status.label}
                        </Badge>
                      </div>
                      {order.description && (
                        <p className="text-[11px] text-muted-foreground/50 font-body mt-0.5 leading-relaxed">{order.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/40 font-body">
                        {gateName && <span>Étape: {gateName}</span>}
                        {order.costImpact != null && order.costImpact !== 0 && (
                          <span className={order.costImpact > 0 ? "text-red-500" : "text-emerald-500"}>
                            {order.costImpact > 0 ? "+" : ""}{order.costImpact.toLocaleString("fr-CH")} CHF
                          </span>
                        )}
                        {order.timeImpactDays != null && order.timeImpactDays !== 0 && (
                          <span>{order.timeImpactDays > 0 ? "+" : ""}{order.timeImpactDays}j</span>
                        )}
                        <span>{new Date(order.createdAt).toLocaleDateString("fr-CH")}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {order.status === "proposed" && (
                        <>
                          <button
                            onClick={() => handleStatus(order.id, "accepted")}
                            className="p-1 text-emerald-500 hover:text-emerald-700 transition-colors"
                            title="Accepter"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => handleStatus(order.id, "rejected")}
                            className="p-1 text-red-400 hover:text-red-600 transition-colors"
                            title="Refuser"
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                      {deletingId === order.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(order.id)} className="text-[10px] text-destructive font-medium">Suppr</button>
                          <button onClick={() => setDeletingId(null)} className="text-[10px] text-muted-foreground">Annuler</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(order.id)}
                          className="p-1 text-muted-foreground/20 hover:text-destructive transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add form */}
          {adding ? (
            <div className="space-y-2 pt-2 border-t border-border/20">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre du change order..."
                className="w-full text-sm font-body bg-background border border-border/40 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optionnel)..."
                rows={2}
                className="w-full text-xs font-body bg-background border border-border/40 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground/40 font-body">Impact coût (CHF)</label>
                  <input
                    type="number" value={costImpact} onChange={(e) => setCostImpact(e.target.value)}
                    placeholder="0"
                    className="w-full text-xs font-body bg-background border border-border/40 rounded-md px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground/40 font-body">Impact jours</label>
                  <input
                    type="number" value={timeImpact} onChange={(e) => setTimeImpact(e.target.value)}
                    placeholder="0"
                    className="w-full text-xs font-body bg-background border border-border/40 rounded-md px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[10px] text-muted-foreground/40 font-body">Étape liée</label>
                  <select
                    value={gateId} onChange={(e) => setGateId(e.target.value)}
                    className="w-full text-xs font-body bg-background border border-border/40 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  >
                    <option value="">Aucune</option>
                    {gates.map((g) => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleCreate} disabled={saving || !title.trim()} className="text-xs">
                  {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : <Plus size={12} className="mr-1" />}
                  Créer
                </Button>
                <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground">Annuler</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary font-medium transition-colors pt-1"
            >
              <Plus size={12} /> Nouveau change order
            </button>
          )}
        </div>
      )}
    </div>
  );
}
