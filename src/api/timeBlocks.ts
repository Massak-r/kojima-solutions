import { apiFetch } from "./client";

/** Sprint-item kinds a block may carry the hour of. */
export type TimeBlockRefKind = "subtask" | "task";

/** A scheduled block on a given day, stored as minutes from midnight.
 *  Free block (refKind null) or the hour assigned to a sprint item
 *  (refKind + refId); endMin null = start-only ("à 14:00"); doneMin
 *  records the real completion minute for the estimation feedback. */
export interface TimeBlock {
  id: string;
  day: string;        // YYYY-MM-DD
  startMin: number;   // minutes from midnight (0–1440)
  endMin: number | null;
  title: string;
  color: string | null;
  refKind: TimeBlockRefKind | null;
  refId: string | null;
  doneMin: number | null;
  createdAt: string;
}

export function listTimeBlocks(day: string): Promise<TimeBlock[]> {
  return apiFetch<TimeBlock[]>(`time_blocks.php?day=${day}`);
}

export function createTimeBlock(data: {
  day: string;
  startMin: number;
  endMin?: number | null;
  title: string;
  color?: string;
  refKind?: TimeBlockRefKind;
  refId?: string;
}): Promise<TimeBlock> {
  return apiFetch<TimeBlock>("time_blocks.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTimeBlock(
  id: string,
  patch: Partial<Pick<TimeBlock, "startMin" | "endMin" | "title" | "color" | "doneMin">>,
): Promise<TimeBlock> {
  return apiFetch<TimeBlock>(`time_blocks.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteTimeBlock(id: string): Promise<void> {
  return apiFetch<void>(`time_blocks.php?id=${id}`, { method: "DELETE" });
}
