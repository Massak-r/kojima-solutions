import { describe, it, expect } from "vitest";
import {
  suggestTriage,
  type SuggestObjectiveLike,
  type SuggestProjectLike,
  type SuggestCaptureLike,
} from "./triageSuggest";
import type { CaptureKind } from "@/api/inboxCaptures";

const objectives: SuggestObjectiveLike[] = [
  { id: "o1", text: "Refonte Acme", category: "Client" },
  { id: "o2", text: "Page tarifs animée", category: "Vitrine" },
];
const projects: SuggestProjectLike[] = [
  { id: "p1", title: "Site Acme", client: "Acme SA" },
  { id: "p2", title: "E-shop Delta", client: "Delta" },
];

const cap = (text: string, kind: CaptureKind | null, hint: string | null = null): SuggestCaptureLike =>
  ({ text, kind, project_hint: hint });

describe("suggestTriage", () => {
  it("routes a Todo with a matching tag to a subtask under the objective", () => {
    const s = suggestTriage(cap("rappeler pour le contrat", "todo", "Acme"), objectives, projects);
    expect(s).not.toBeNull();
    expect(s!.action).toBe("subtask");
    expect(s!.targetKind).toBe("objective");
    expect(s!.targetId).toBe("o1");
    expect(s!.confidence).toBe("high");
    expect(s!.label).toContain("Étape");
  });

  it("routes an Urgent capture to a subtask too", () => {
    const s = suggestTriage(cap("bug paiement Refonte Acme", "urgent", null), objectives, projects);
    expect(s!.action).toBe("subtask");
    expect(s!.targetId).toBe("o1");
  });

  it("files a tagged Note on the matching project (note → project)", () => {
    const s = suggestTriage(cap("le client veut un blog", "note", "Acme"), objectives, projects);
    expect(s!.action).toBe("note");
    expect(s!.targetKind).toBe("project");
    expect(s!.targetId).toBe("p1");
  });

  it("files an untyped capture as a note on the best keyword match", () => {
    const s = suggestTriage(cap("idée pour la page tarifs animée", null, null), objectives, projects);
    expect(s!.action).toBe("note");
    expect(s!.targetKind).toBe("objective");
    expect(s!.targetId).toBe("o2");
  });

  it("gives no suggestion for a Todo when only a project matches (can't subtask a project)", () => {
    const s = suggestTriage(cap("penser au truc", "todo", "Delta"), objectives, projects);
    expect(s).toBeNull();
  });

  it("gives no suggestion when nothing matches", () => {
    const s = suggestTriage(cap("réfléchir à un truc vague", "note", null), objectives, projects);
    expect(s).toBeNull();
  });

  it("is medium-confidence on a keyword-only hit, high when the tag matches", () => {
    const keyword = suggestTriage(cap("avancer sur la Refonte Acme", "todo", null), objectives, projects);
    expect(keyword!.confidence).toBe("medium"); // text hit only = +5
    const tagged = suggestTriage(cap("avancer", "todo", "Refonte Acme"), objectives, projects);
    expect(tagged!.confidence).toBe("high"); // exact tag = +10
  });
});
