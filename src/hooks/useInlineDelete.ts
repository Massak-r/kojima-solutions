import { useState, useCallback } from "react";

/**
 * Hook for 2-step inline delete confirmation.
 * First call `requestDelete(id)` to show confirm buttons,
 * then `confirmDelete(callback)` to execute, or `cancelDelete()` to abort.
 */
export function useInlineDelete() {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const requestDelete = useCallback((id: string) => {
    setConfirmingId(id);
  }, []);

  const confirmDelete = useCallback((callback: () => void) => {
    callback();
    setConfirmingId(null);
  }, []);

  const cancelDelete = useCallback(() => {
    setConfirmingId(null);
  }, []);

  return { confirmingId, requestDelete, confirmDelete, cancelDelete };
}
