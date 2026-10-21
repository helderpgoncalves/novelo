/** Primeiros passos do checklist, por ordem. */
export const CHECKLIST_ITEMS = ['scenario', 'copilot', 'map'] as const;
export type ChecklistId = (typeof CHECKLIST_ITEMS)[number];
