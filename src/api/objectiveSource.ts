import type { ObjectiveItem } from './objectives';
import * as admin from './objectives';
import * as personal from './personalTodos';
import type { PersonalTodoItem } from './personalTodos';

export type ObjectiveSource = 'personal' | 'admin';

/**
 * Unified objective shape that works across personal_todos and admin_todos.
 * personal_todos has no 'category' column, so it's optional here.
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
}

function toUnifiedFromAdmin(o: ObjectiveItem): UnifiedObjective {
  return {
    ...o,
    source: 'admin',
    definitionOfDone: (o as any).definitionOfDone ?? null,
    linkedProjectId:  (o as any).linkedProjectId ?? null,
    linkedClientId:   (o as any).linkedClientId ?? null,
  };
}

function toUnifiedFromPersonal(o: PersonalTodoItem): UnifiedObjective {
  return {
    ...o,
    source: 'personal',
    category: undefined,
    definitionOfDone: (o as any).definitionOfDone ?? null,
    linkedProjectId:  (o as any).linkedProjectId ?? null,
    linkedClientId:   (o as any).linkedClientId ?? null,
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
  if (source === 'admin') {
    return admin.updateObjective(id, data as any);
  }
  return personal.updatePersonalTodo(id, data as any);
}
