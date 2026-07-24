export type CommandPaletteAction = {
  id: string;
  label: string;
  description?: string;
  group: string;
  icon?: string;
  tone?: 'neutral' | 'cyan' | 'green' | 'violet';
  keywords?: readonly string[];
  priority?: number;
  disabled?: boolean;
  execute: () => void | Promise<void>;
};

export type RegisteredCommandPaletteAction = CommandPaletteAction & {
  registryId: string;
  order: number;
};
