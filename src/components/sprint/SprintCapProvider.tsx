import { createContext, useCallback, useContext, useState } from "react";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { TimelineTask } from "@/types/timeline";

/**
 * Discriminated union for items that can appear in today's sprint.
 * - subtask: a flagged objective subtask (admin/personal)
 * - task: a flagged project TimelineTask
 */
export type SprintItem =
  | { kind: "subtask"; subtask: SubtaskItem }
  | { kind: "task"; projectId: string; task: TimelineTask };

interface SprintCapDialogState {
  open: boolean;
  candidate: SprintItem | null;
  currentSprint: SprintItem[];
}

interface SprintCapContextValue {
  dialogState: SprintCapDialogState;
  requestFlag: (candidate: SprintItem, currentSprint: SprintItem[]) => void;
  closeDialog: () => void;
}

const SprintCapContext = createContext<SprintCapContextValue | null>(null);

export function SprintCapProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<SprintCapDialogState>({
    open: false,
    candidate: null,
    currentSprint: [],
  });

  const requestFlag = useCallback((candidate: SprintItem, currentSprint: SprintItem[]) => {
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

/** Display helpers shared by the dialog and the urgent backlog. */
export function sprintItemId(item: SprintItem): string {
  return item.kind === "subtask" ? item.subtask.id : item.task.id;
}

export function sprintItemText(item: SprintItem): string {
  return item.kind === "subtask" ? item.subtask.text : item.task.title;
}

export function sprintItemParentId(item: SprintItem): string {
  return item.kind === "subtask" ? item.subtask.parentId : item.projectId;
}
