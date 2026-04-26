import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutList, MessageSquare, Receipt, TrendingUp, AlertTriangle } from "lucide-react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { totalQuote } from "@/types/quote";
import { MiniStat } from "./MiniStat";
import { formatCHF } from "./helpers";

export function StatsBar() {
  const navigate = useNavigate();
  const { projects } = useProjects();
  const { quotes } = useQuotes();

  const activeProjects = useMemo(
    () => projects.filter(p => p.status === "in-progress").length,
    [projects],
  );
  const pendingResponses = useMemo(
    () => projects.reduce((sum, p) =>
      sum + (p.tasks || []).flatMap(t => t.feedbackRequests || []).filter(r => r.resolved && r.response).length, 0),
    [projects],
  );
  const invoicesToReview = useMemo(
    () => quotes.filter(q => q.invoiceStatus === "to-validate").length,
    [quotes],
  );
  const totalRevenue = useMemo(
    () => quotes.filter(q => q.invoiceStatus === "paid").reduce((sum, q) => sum + totalQuote(q), 0),
    [quotes],
  );
  const overdueInvoices = useMemo(
    () => quotes.filter(q => {
      if (q.invoiceStatus !== "validated") return false;
      const validity = q.validityDate ? new Date(q.validityDate) : null;
      if (!validity) return false;
      return validity.getTime() < Date.now();
    }).length,
    [quotes],
  );
  const outstandingTotal = useMemo(
    () => quotes.filter(q => q.invoiceStatus === "validated").reduce((sum, q) => sum + totalQuote(q), 0),
    [quotes],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-card border border-border rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2"
    >
      <MiniStat icon={<LayoutList size={13} className="text-primary" />} label="Projets" value={activeProjects} onClick={() => navigate("/projects")} />
      <MiniStat icon={<MessageSquare size={13} className="text-palette-amber" />} label="Réponses" value={pendingResponses} pulse={pendingResponses > 0} onClick={() => navigate("/projects")} />
      <MiniStat icon={<Receipt size={13} className="text-accent" />} label="À valider" value={invoicesToReview} pulse={invoicesToReview > 0} onClick={() => navigate("/quotes")} />
      <MiniStat icon={<TrendingUp size={13} className="text-palette-sage" />} label="Revenu" value={formatCHF(totalRevenue)} onClick={() => navigate("/quotes")} />
      <MiniStat icon={<AlertTriangle size={13} className="text-destructive" />} label="En retard" value={overdueInvoices} pulse={overdueInvoices > 0} onClick={() => navigate("/accounting")} />
      <MiniStat icon={<Receipt size={13} className="text-primary" />} label="À recevoir" value={formatCHF(outstandingTotal)} onClick={() => navigate("/accounting")} />
    </motion.div>
  );
}
