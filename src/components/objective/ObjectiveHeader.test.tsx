import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ObjectiveHeader } from "./ObjectiveHeader";
import type { UnifiedObjective } from "@/api/objectiveSource";

const baseObjective: UnifiedObjective = {
  id: "o1",
  source: "admin",
  text: "Mon objectif",
  completed: false,
  category: "Interne",
  dueDate: null,
  recurring: null,
  isObjective: true,
  description: null,
  smartSpecific: null,
  smartMeasurable: null,
  smartAchievable: null,
  smartRelevant: null,
  priority: "medium",
  status: "in_progress",
  definitionOfDone: null,
  linkedProjectId: null,
  linkedClientId: null,
  order: 0,
  createdAt: "2026-01-01T00:00:00Z",
};

function renderHeader(objective: UnifiedObjective) {
  const onToggleComplete = vi.fn();
  render(
    <ObjectiveHeader
      objective={objective}
      completedSubtasks={0}
      totalSubtasks={0}
      onBack={() => {}}
      onTitleSave={() => {}}
      onStatusChange={() => {}}
      onPriorityChange={() => {}}
      onDueDateChange={() => {}}
      onToggleComplete={onToggleComplete}
    />,
  );
  return { onToggleComplete };
}

describe("ObjectiveHeader — completion toggle", () => {
  it("offers 'Terminer l'objectif' when active and fires the callback", () => {
    const { onToggleComplete } = renderHeader(baseObjective);

    // "Terminé" still appears as an (inactive) status pill, so target the
    // unique completion CTA by its full label rather than that word.
    const finish = screen.getByRole("button", { name: /terminer l'objectif/i });
    expect(screen.queryByRole("button", { name: /rouvrir/i })).toBeNull();

    fireEvent.click(finish);
    expect(onToggleComplete).toHaveBeenCalledTimes(1);
  });

  it("offers 'Rouvrir' once completed and fires the callback", () => {
    const { onToggleComplete } = renderHeader({ ...baseObjective, completed: true, status: "done" });

    const reopen = screen.getByRole("button", { name: /rouvrir/i });
    expect(screen.queryByRole("button", { name: /terminer l'objectif/i })).toBeNull();

    fireEvent.click(reopen);
    expect(onToggleComplete).toHaveBeenCalledTimes(1);
  });
});
