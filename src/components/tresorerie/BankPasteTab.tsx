import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardPaste, Loader2, Trash2, Send, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatChf } from "@/lib/currency";
import { formatDateSwiss } from "@/lib/dateFormat";
import { useToast } from "@/hooks/use-toast";
import { parseBankPaste } from "@/lib/bankPaste";
import {
  importBankTransactions, listBankTransactions, deleteBankTransaction,
} from "@/api/bankTransactions";

const money = (n: number) => `${n < 0 ? "−" : "+"} ${formatChf(Math.abs(n))} CHF`;

export function BankPasteTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parseBankPaste(text), [text]);

  const { data: stored = [], isLoading } = useQuery({
    queryKey: ["bank-transactions"],
    queryFn: listBankTransactions,
    staleTime: 30_000,
  });

  async function send() {
    if (parsed.transactions.length === 0) return;
    setSaving(true);
    try {
      const res = await importBankTransactions(parsed.transactions);
      toast({
        title: `${res.stored} transaction(s) importée(s)`,
        description: res.skipped > 0
          ? `${res.skipped} déjà présente(s) — pas de doublon.`
          : "Soroban les récupérera à la prochaine synchro.",
      });
      setText("");
      qc.invalidateQueries({ queryKey: ["bank-transactions"] });
    } catch {
      toast({ title: "Échec de l'import", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteBankTransaction(id);
      qc.invalidateQueries({ queryKey: ["bank-transactions"] });
    } catch {
      toast({ title: "Suppression échouée", variant: "destructive" });
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <ClipboardPaste className="h-5 w-5 text-primary" /> Coller un relevé → À classer (Soroban)
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Copie la liste des transactions depuis ton e-banking et colle-la ici. Chaque ligne devient une dépense à classer côté Soroban.
        </p>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Colle ici le tableau des transactions (Type, Date, Informations, Crédit, Débit, Solde…)"
        className="font-body text-xs"
      />

      {parsed.transactions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="font-medium">{parsed.transactions.length} transaction(s) détectée(s)</span>
              {parsed.balancesConsistent === true && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={13} /> soldes cohérents</span>
              )}
              {parsed.balancesConsistent === false && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600"><AlertTriangle size={13} /> écart de solde — vérifie la liste</span>
              )}
            </div>
            <Button size="sm" onClick={send} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer vers Soroban
            </Button>
          </div>

          <ul className="space-y-1.5">
            {parsed.transactions.map((t) => (
              <li key={t.sourceKey} className="flex items-center gap-3 border rounded-lg p-2.5 text-sm">
                <span className="text-muted-foreground tabular-nums shrink-0 w-14">{formatDateSwiss(t.bookingDate).slice(0, 5)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.counterparty || t.description}</div>
                  {t.counterparty && t.description && t.description !== t.counterparty && (
                    <div className="text-xs text-muted-foreground truncate">{t.description}</div>
                  )}
                </div>
                <span className={cn("tabular-nums font-medium shrink-0", t.amount < 0 ? "text-destructive" : "text-emerald-600")}>{money(t.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {text.trim() && parsed.transactions.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          Aucune transaction reconnue. Vérifie que tu as collé le tableau complet depuis l'e-banking.
        </p>
      )}

      <div className="pt-2">
        <h3 className="text-eyebrow mb-2">Importées</h3>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
        ) : stored.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Rien d'importé pour l'instant.</p>
        ) : (
          <ul className="space-y-1.5">
            {stored.map((t) => (
              <li key={t.id} className="group flex items-center gap-3 border rounded-lg p-2.5 text-sm">
                <span className="text-muted-foreground tabular-nums shrink-0 w-14">{formatDateSwiss(t.bookingDate).slice(0, 5)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.counterparty || t.description}</div>
                </div>
                {t.pulledAt ? (
                  <span className="text-[10px] text-emerald-600 inline-flex items-center gap-1 shrink-0"><CheckCircle2 size={11} /> Soroban</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground shrink-0">en attente</span>
                )}
                <span className={cn("tabular-nums font-medium shrink-0", t.amount < 0 ? "text-destructive" : "text-emerald-600")}>{money(t.amount)}</span>
                <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 transition text-destructive shrink-0" title="Supprimer">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
