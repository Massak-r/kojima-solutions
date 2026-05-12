import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { QuickCreateDialog, type QuickCreateKind } from "@/components/quick-create/QuickCreateDialog";

interface QuickCreateApi {
  open: (kind: QuickCreateKind) => void;
}

const QuickCreateContext = createContext<QuickCreateApi | null>(null);

/**
 * Mount this inside any provider whose hooks the QuickCreateDialog uses
 * (Projects, Clients). The dialog itself reads its surface from `kind`;
 * `null` keeps it closed.
 */
export function QuickCreateProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<QuickCreateKind | null>(null);
  const close = useCallback(() => setKind(null), []);
  const open = useCallback((k: QuickCreateKind) => setKind(k), []);

  return (
    <QuickCreateContext.Provider value={{ open }}>
      {children}
      <QuickCreateDialog kind={kind} onClose={close} />
    </QuickCreateContext.Provider>
  );
}

export function useQuickCreate(): QuickCreateApi {
  const ctx = useContext(QuickCreateContext);
  if (!ctx) throw new Error("useQuickCreate must be used inside <QuickCreateProvider>");
  return ctx;
}
