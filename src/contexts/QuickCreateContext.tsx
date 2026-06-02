import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { QuickCreateDialog, type QuickCreateKind, type QuickCreatePreset } from "@/components/quick-create/QuickCreateDialog";

interface QuickCreateApi {
  open: (kind: QuickCreateKind, preset?: QuickCreatePreset) => void;
}

const QuickCreateContext = createContext<QuickCreateApi | null>(null);

/**
 * Mount this inside any provider whose hooks the QuickCreateDialog uses
 * (Projects, Clients). The dialog itself reads its surface from `kind`;
 * `null` keeps it closed. An optional `preset` seeds the form (e.g. opening
 * "Nouveau projet" from a client fiche with that client pre-selected).
 */
export function QuickCreateProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<QuickCreateKind | null>(null);
  const [preset, setPreset] = useState<QuickCreatePreset | undefined>(undefined);
  const close = useCallback(() => setKind(null), []);
  const open = useCallback((k: QuickCreateKind, p?: QuickCreatePreset) => {
    setPreset(p);
    setKind(k);
  }, []);

  return (
    <QuickCreateContext.Provider value={{ open }}>
      {children}
      <QuickCreateDialog kind={kind} preset={preset} onClose={close} />
    </QuickCreateContext.Provider>
  );
}

export function useQuickCreate(): QuickCreateApi {
  const ctx = useContext(QuickCreateContext);
  if (!ctx) throw new Error("useQuickCreate must be used inside <QuickCreateProvider>");
  return ctx;
}
