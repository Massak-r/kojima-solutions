import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

export interface UseUndoableDeleteOptions<T extends { id: string }> {
  /** Fires immediately when delete is staged. The UI removes the row right away. */
  hardDelete: (id: string) => void;
  /** Called when the user clicks Undo within the toast window. Should re-create the item. */
  restore: (item: T) => void;
  /** Toast title. Function form lets callers reference the item. */
  message?: string | ((item: T) => string);
  /** Label on the undo action button. */
  undoLabel?: string;
  /** Toast duration in ms. After this, the row stays deleted. */
  durationMs?: number;
}

/**
 * Optimistic-delete-with-undo pattern. The deletion runs immediately and a
 * Sonner toast with an Undo action is shown; clicking Undo within the window
 * calls `restore(item)` to re-create the row with the same payload.
 *
 * Why optimistic over deferred: callers route through react-query optimistic
 * mutations, so cache state is already consistent — `restore` re-inserts via
 * the existing create path and the UI converges naturally.
 */
export function useUndoableDelete<T extends { id: string }>({
  hardDelete,
  restore,
  message = "Supprimé",
  undoLabel = "Annuler",
  durationMs = 6000,
}: UseUndoableDeleteOptions<T>) {
  const pendingRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const deleteWithUndo = useCallback(
    (item: T) => {
      const id = item.id;
      const text = typeof message === "function" ? message(item) : message;
      let undone = false;

      hardDelete(id);

      const timer = setTimeout(() => {
        pendingRef.current.delete(id);
      }, durationMs);
      pendingRef.current.set(id, timer);

      toast(text, {
        duration: durationMs,
        action: {
          label: undoLabel,
          onClick: () => {
            if (undone) return;
            undone = true;
            const pending = pendingRef.current.get(id);
            if (pending) {
              clearTimeout(pending);
              pendingRef.current.delete(id);
            }
            restore(item);
          },
        },
      });
    },
    [hardDelete, restore, message, undoLabel, durationMs],
  );

  return { deleteWithUndo };
}
