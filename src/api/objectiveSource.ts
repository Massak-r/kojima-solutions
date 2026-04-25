import type { ObjectiveItem, TodoPriority, TodoStatus } from './objectives';
import * as admin from './objectives';
import * as personal from './personalTodos';
import type { PersonalTodoItem } from './personalTodos';

export type ObjectiveSource = 'personal' | 'admin';

export const PERSONAL_VIRTUAL_CATEGORY = 'Perso';

/**
 * Unified objective shape that works across personal_todos and admin_todos.
 * personal_todos has no 'category' column, so personal rows get a virtual
 * PERSONAL_VIRTUAL_CATEGORY stamp at read time so the UI can group them.
 */
export interface UnifiedObjective {
  id: string;
  source: ObjectiveSource;
  text: string;
  completed: boolean;
  category?: string;
  dueDate?: string | null;
  recurring?: string | null;
  isObjective: boolean;
  description?: string | null;
  smartSpecific?: string | null;
  smartMeasurable?: string | null;
  smartAchievable?: string | null;
  smartRelevant?: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'not_started' | 'in_progress' | 'done' | 'blocked';
  definitionOfDone?: string | null;
  linkedProjectId?: string | null;
  linkedClientId?: string | null;
  order: number;
  createdAt: string;
  updatedAt?: string | null;
}

function toUnifiedFromAdmin(o: ObjectiveItem): UnifiedObjective {
  return {
    ...o,
    source: 'admin',
    definitionOfDone: o.definitionOfDone ?? null,
    linkedProjectId:  o.linkedProjectId  ?? null,
    linkedClientId:   o.linkedClientId   ?? null,
  };
}

function toUnifiedFromPersonal(o: PersonalTodoItem): UnifiedObjective {
  return {
    ...o,
    source: 'personal',
    category: PERSONAL_VIRTUAL_CATEGORY,
    definitionOfDone: o.definitionOfDone ?? null,
    linkedProjectId:  o.linkedProjectId  ?? null,
    linkedClientId:   o.linkedClientId   ?? null,
  };
}

export async function getObjective(source: ObjectiveSource, id: string): Promise<UnifiedObjective | null> {
  if (source === 'admin') {
    const list = await admin.listObjectives();
    const match = list.find(o => o.id === id);
    return match ? toUnifiedFromAdmin(match) : null;
  }
  const list = await personal.listPersonalTodos();
  const match = list.find(o => o.id === id);
  return match ? toUnifiedFromPersonal(match) : null;
}

export function updateObjectiveBySource(
  source: ObjectiveSource,
  id: string,
  data: Partial<UnifiedObjective>,
) {
  // Strip the fields that don't exist on the underlying row shape (source is
  // our synthesized discriminator, category is virtual for personal todos).
  const { source: _source, ...rest } = data;
  if (source === 'admin') {
    return admin.updateObjective(id, rest);
  }
  const { category: _category, ...personalRest } = rest;
  return personal.updatePersonalTodo(id, personalRest);
}

export type CreateObjectivePayload = {
  text: string;
  category?: string;
  dueDate?: string;
  recurring?: string;
  isObjective?: boolean;
  description?: string;
  smartSpecific?: string;
  smartMeasurable?: string;
  smartAchievable?: string;
  smartRelevant?: string;
  priority?: TodoPriority;
  status?: TodoStatus;
};

export async function createObjectiveBySource(
  source: ObjectiveSource,
  data: CreateObjectivePayload,
): Promise<UnifiedObjective> {
  if (source === 'admin') {
    const created = await admin.createObjective(data);
    return toUnifiedFromAdmin(created);
  }
  const { category: _ignored, ...rest } = data;
  const created = await personal.createPersonalTodo(rest);
  return toUnifiedFromPersonal(created);
}

export function deleteObjectiveBySource(source: ObjectiveSource, id: string) {
  if (source === 'admin') {
    return admin.deleteObjective(id);
  }
  return personal.deletePersonalTodo(id);
}

/**
 * Fetch both admin and personal objectives in parallel and return them
 * merged into a single list tagged with source. Personal rows are stamped
 * with PERSONAL_VIRTUAL_CATEGORY so the UI can group them alongside admin
 * categories without special-casing.
 */
export async function listAllUnified(
  adminCategories?: readonly string[],
): Promise<UnifiedObjective[]> {
  const [adminList, personalList] = await Promise.all([
    admin.listObjectives(adminCategories),
    personal.listPersonalTodos(),
  ]);
  return [
    ...adminList.map(toUnifiedFromAdmin),
    ...personalList.map(toUnifiedFromPersonal),
  ];
}
