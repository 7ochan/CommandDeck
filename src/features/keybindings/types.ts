export const ACTION_CATEGORIES = [
  'Application',
  'Workspace',
  'Terminal',
  'Developer Hub',
  'Navigation',
] as const;

export type ActionCategory = (typeof ACTION_CATEGORIES)[number];

export type ActionDefinition = {
  id: string;
  displayName: string;
  category: ActionCategory;
  description: string;
  defaultShortcut: string;
  allowInInputs?: boolean;
  allowInTerminal?: boolean;
};

export type RegisteredAction = ActionDefinition & {
  currentShortcut: string;
  isCustomized: boolean;
};

export type KeybindingMap = Record<string, string>;

export type ShortcutConflict = {
  conflictingActionId: string;
  conflictingActionName: string;
  shortcut: string;
  pendingActionId: string;
  pendingShortcut: string;
};
