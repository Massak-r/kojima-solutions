import { createContext, useCallback, useContext, useState } from "react";
import type { SubtaskItem } from "@/api/todoSubtasks";

interface SprintCapDialogState {
  open: boolean;
  candidate: SubtaskItem | null;
  currentSprint: SubtaskItem[];
}

interface SprintCapContextValue {
  dialogState: SprintCapDialogState;
  requestFlag: (candidate: SubtaskItem, currentSprint: SubtaskItem[]) => void;
  closeDialog: () => void;
}

const SprintCapContext = createContext<SprintCapContextValue | null>(null);

export function SprintCapProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<SprintCapDialogState>({
    open: false,
    candidate: null,
    currentSprint: [],
  });

  const requestFlag = useCallback((candidate: SubtaskItem, currentSprint: SubtaskItem[]) => {
    setDialogState({ open: true, candidate, currentSprint });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState(s => ({ ...s, open: false }));
  }, []);

  return (
    <SprintCapContext.Provider value={{ dialogState, requestFlag, closeDialog }}>
      {children}
    </SprintCapContext.Provider>
  );
}

export function useSprintCapContext(): SprintCapContextValue {
  const ctx = useContext(SprintCapContext);
  if (!ctx) throw new Error("useSprintCapContext must be used inside SprintCapProvider");
  return ctx;
}
