import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getFunnel, listChangeOrders, type ProjectFunnel, type ChangeOrder, type Tier } from "@/api/funnels";

const TIER_LABELS: Record<Tier, string> = {
  essential: "Essentiel",
  professional: "Professionnel",
  custom: "Sur mesure",
};

const STATUS_FR: Record<string, string> = {
  locked: "Verrouillé",
  open: "En attente",
  approved: "Validé",
  revision: "Révision",
  pending: "En attente",
  active: "Actif",
  completed: "Terminé",
  skipped: "Ignoré",
  proposed: "Proposé",
  accepted: "Accepté",
  rejected: "Refusé",
};

const TYPE_FR: Record<string, string> = {
  choice: "Choix",
  approval: "Approbation",
  feedback: "Feedback",
};

export default function FunnelPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [funnel, setFunnel] = useState<ProjectFunnel | null>(null);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    getFunnel(id)
      .then((f) => {
        setFunnel(f);
        listChangeOrders(f.id).then(setChangeOrders).catch(() => {});
      })
      .catch(() => setError(true));
  }, [id]);

  // Print injection (same pattern as QuotePrintPage)
  useEffect(() => {
    if (!funnel) return;
    const style = document.createElement("style");
    style.id = "funnel-print-style";
    style.textContent =
      "@page { size: A4; margin: 15mm; } @media print { html, body { height: auto !important; overflow: visible !important; } }";
    document.head.appendChild(style);

    const isInIframe = window.self !== window.top;
    const timer = isInIframe ? undefined : setTimeout(() => window.print(), 600);

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      if (document.head.contains(style)) document.head.removeChild(style);
    };
  }, [funnel]);

  if (error || (!funnel && id)) {
    return (
      <div style={{ fontFamily: "system-ui", padding: "40px", textAlign: "center", color: "#666" }}>
        <p>Document introuvable.</p>
        <Link to="/" style={{ color: "#2563eb", fontSize: "14px" }}>Retour</Link>
      </div>
    );
  }

  if (!funnel) return null;

  const totalBudget = funnel.phases.reduce((s, p) => s + (p.budget ?? 0), 0);
  const totalGates = funnel.phases.reduce((s, p) => s + p.gates.length, 0);
  const approvedGates = funnel.phases.reduce((s, p) => s + p.gates.filter((g) => g.status === "approved").length, 0);
  const now = new Date().toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" });
  const acceptedCOs = changeOrders.filter((co) => co.status === "accepted");
  const totalCostImpact = acceptedCOs.reduce((s, co) => s + (co.costImpact ?? 0), 0);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#1a1a1a", maxWidth: "210mm", margin: "0 auto", fontSize: "12px", lineHeight: "1.6" }}>
      {/* Header */}
      <div style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: "12px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>
            Résumé du projet
          </h1>
          <p style={{ color: "#666", fontSize: "11px", margin: "4px 0 0" }}>{now}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "10px", color: "#999", margin: 0 }}>kojima-solutions.ch</p>
          {funnel.tier && (
            <span style={{
              display: "inline-block", marginTop: "4px", fontSize: "10px", fontWeight: 600,
              padding: "2px 8px", borderRadius: "9999px",
              background: funnel.tier === "essential" ? "#f3f4f6" : funnel.tier === "professional" ? "#dbeafe" : "#ede9fe",
              color: funnel.tier === "essential" ? "#374151" : funnel.tier === "professional" ? "#1d4ed8" : "#6d28d9",
            }}>
              {TIER_LABELS[funnel.tier]}
            </span>
          )}
        </div>
      </div>

      {/* Meta */}
      {funnel.decisionMakerName && (
        <p style={{ fontSize: "11px", color: "#666", marginBottom: "16px" }}>
          Décideur : <strong style={{ color: "#1a1a1a" }}>{funnel.decisionMakerName}</strong>
          {funnel.decisionMakerEmail && ` (${funnel.decisionMakerEmail})`}
        </p>
      )}

      {/* Progress */}
      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px 16px", marginBottom: "24px", display: "flex", justifyContent: "space-between" }}>
        <span>Progression : <strong>{approvedGates}/{totalGates}</strong> décisions validées</span>
        {totalBudget > 0 && <span>Budget total : <strong>{totalBudget.toLocaleString("fr-CH")} CHF</strong></span>}
      </div>

      {/* Phases */}
      {funnel.phases.map((phase, pIdx) => (
        <div key={phase.id} style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "6px", marginBottom: "8px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>
              Phase {pIdx + 1} : {phase.title}
            </h2>
            <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "#666" }}>
              <span>{STATUS_FR[phase.status] ?? phase.status}</span>
              {phase.budget != null && phase.budget > 0 && (
                <span style={{ fontWeight: 600, color: "#1a1a1a" }}>{phase.budget.toLocaleString("fr-CH")} CHF</span>
              )}
            </div>
          </div>

          {phase.gates.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>Porte</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, borderBottom: "1px solid #e5e7eb", width: "70px" }}>Type</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, borderBottom: "1px solid #e5e7eb", width: "80px" }}>Statut</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>Détails</th>
                </tr>
              </thead>
              <tbody>
                {phase.gates.map((gate) => {
                  const selectedOption = gate.options.find((o) => o.isSelected);
                  return (
                    <tr key={gate.id}>
                      <td style={{ padding: "4px 8px", borderBottom: "1px solid #f3f4f6" }}>{gate.title}</td>
                      <td style={{ padding: "4px 8px", borderBottom: "1px solid #f3f4f6", color: "#666" }}>{TYPE_FR[gate.gateType]}</td>
                      <td style={{ padding: "4px 8px", borderBottom: "1px solid #f3f4f6" }}>
                        <span style={{
                          fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "4px",
                          background: gate.status === "approved" ? "#d1fae5" : gate.status === "open" ? "#dbeafe" : gate.status === "revision" ? "#fef3c7" : "#f3f4f6",
                          color: gate.status === "approved" ? "#065f46" : gate.status === "open" ? "#1e40af" : gate.status === "revision" ? "#92400e" : "#6b7280",
                        }}>
                          {STATUS_FR[gate.status]}
                        </span>
                      </td>
                      <td style={{ padding: "4px 8px", borderBottom: "1px solid #f3f4f6", color: "#666" }}>
                        {gate.status === "approved" && gate.approvedAt && (
                          <span>Validé le {new Date(gate.approvedAt).toLocaleDateString("fr-CH")}{gate.approvedBy ? ` par ${gate.approvedBy}` : ""}</span>
                        )}
                        {selectedOption && <span>Choix : {selectedOption.title}</span>}
                        {gate.revisionCount > 0 && <span> · {gate.revisionCount} révision{gate.revisionCount > 1 ? "s" : ""}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {/* Change Orders */}
      {changeOrders.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, borderBottom: "1px solid #e5e7eb", paddingBottom: "6px", marginBottom: "8px" }}>
            Change Orders
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>Titre</th>
                <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, borderBottom: "1px solid #e5e7eb", width: "70px" }}>Statut</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 600, borderBottom: "1px solid #e5e7eb", width: "90px" }}>Coût</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 600, borderBottom: "1px solid #e5e7eb", width: "70px" }}>Jours</th>
              </tr>
            </thead>
            <tbody>
              {changeOrders.map((co) => (
                <tr key={co.id}>
                  <td style={{ padding: "4px 8px", borderBottom: "1px solid #f3f4f6" }}>{co.title}</td>
                  <td style={{ padding: "4px 8px", borderBottom: "1px solid #f3f4f6" }}>{STATUS_FR[co.status]}</td>
                  <td style={{ padding: "4px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>
                    {co.costImpact != null && co.costImpact !== 0 ? `${co.costImpact > 0 ? "+" : ""}${co.costImpact.toLocaleString("fr-CH")} CHF` : "-"}
                  </td>
                  <td style={{ padding: "4px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>
                    {co.timeImpactDays != null && co.timeImpactDays !== 0 ? `${co.timeImpactDays > 0 ? "+" : ""}${co.timeImpactDays}j` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalCostImpact !== 0 && (
            <p style={{ fontSize: "11px", textAlign: "right", marginTop: "8px", fontWeight: 600 }}>
              Impact total accepté : {totalCostImpact > 0 ? "+" : ""}{totalCostImpact.toLocaleString("fr-CH")} CHF
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: "32px", paddingTop: "12px", borderTop: "1px solid #e5e7eb", fontSize: "10px", color: "#999", display: "flex", justifyContent: "space-between" }}>
        <span>Kojima Solutions - kojima-solutions.ch</span>
        <span>Généré le {now}</span>
      </div>
    </div>
  );
}
