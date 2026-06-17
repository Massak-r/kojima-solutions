import { apiFetch } from "./client";

/** A scheduled block on a given day, stored as minutes from midnight. */
export interface TimeBlock {
  id: string;
  day: string;        // YYYY-MM-DD
  startMin: number;   // minutes from midnight (0–1440)
  endMin: number;
  title: string;
  color: string | null;
  createdAt: string;
}

export function listTimeBlocks(day: string): Promise<TimeBlock[]> {
  return apiFetch<TimeBlock[]>(`time_blocks.php?day=${day}`);
}

export function createTimeBlock(data: {
  day: string;
  startMin: number;
  endMin: number;
  title: string;
  color?: string;
}): Promise<TimeBlock> {
  return apiFetch<TimeBlock>("time_blocks.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTimeBlock(
  id: string,
  patch: Partial<Pick<TimeBlock, "startMin" | "endMin" | "title" | "color">>,
): Promise<TimeBlock> {
  return apiFetch<TimeBlock>(`time_blocks.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteTimeBlock(id: string): Promise<void> {
  return apiFetch<void>(`time_blocks.php?id=${id}`, { method: "DELETE" });
}
