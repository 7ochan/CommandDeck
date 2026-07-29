'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import { parseCommandTemplate } from '@/shared/command-template';
import { Icon } from '@/components/ui/icon';
import { CommandTemplateHighlight } from './command-template-highlight';

type AddDeckItemDialogProps = {
  isOpen: boolean;
  onCancel: () => void;
  onSave: (
    displayName: string,
    command: string,
    description?: string | null,
  ) => Promise<void>;
};

export function AddDeckItemDialog({
  isOpen,
  onCancel,
  onSave,
}: AddDeckItemDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [displayName, setDisplayName] = useState('');
  const [command, setCommand] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedTemplate = useMemo(
    () => parseCommandTemplate(command),
    [command],
  );

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      setDisplayName('');
      setCommand('');
      setDescription('');
      setError(null);
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!command.trim()) {
      setError('Command is required.');
      return;
    }

    if (!parsedTemplate.isValid) {
      setError(
        parsedTemplate.errors[0]?.message ??
          'Fix the template syntax before saving.',
      );
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(displayName.trim(), command, description.trim() || null);
      onCancel();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to add Deck shortcut.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="cd-dialog w-[min(34rem,calc(100vw-1.5rem))] p-0"
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (isSaving) {
          event.preventDefault();
        } else {
          onCancel();
        }
      }}
    >
      <form
        onSubmit={submit}
        className="flex max-h-[calc(100dvh-3rem)] flex-col overflow-hidden"
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-soft)] bg-[var(--surface-2)] px-4">
          <div className="flex items-center gap-2">
            <span
              className="flex size-6 items-center justify-center rounded-md bg-[var(--surface-3)] text-[var(--accent)]"
              aria-hidden="true"
            >
              <Icon name="plus" size={14} />
            </span>
            <h2
              id={titleId}
              className="text-[13px] font-semibold text-[var(--text-primary)]"
            >
              Add Deck Shortcut
            </h2>
          </div>

          <button
            type="button"
            disabled={isSaving}
            className="cd-icon-button cd-button--quiet size-7 text-[var(--text-muted)]"
            aria-label="Cancel"
            onClick={onCancel}
          >
            <Icon name="x" size={14} />
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto p-4">
          {error && (
            <p
              className="rounded-lg border border-[rgb(239_141_152_/_25%)] bg-[var(--danger-soft)] p-3 text-[11px] font-medium text-[var(--danger)]"
              role="alert"
            >
              {error}
            </p>
          )}

          <div>
            <label
              htmlFor="add-deck-name"
              className="block text-[11px] font-medium text-[var(--text-muted)]"
            >
              Display Name
            </label>
            <input
              id="add-deck-name"
              type="text"
              maxLength={120}
              placeholder="e.g. Run Dev Server"
              value={displayName}
              disabled={isSaving}
              className="cd-input mt-1.5 h-9"
              onChange={(event) => setDisplayName(event.currentTarget.value)}
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor="add-deck-command"
                className="block text-[11px] font-medium text-[var(--text-muted)]"
              >
                Command string or template
              </label>

              <span className="font-mono text-[10px] text-[var(--text-subtle)]">
                Use {'{{var}}'} for placeholders
              </span>
            </div>

            <textarea
              id="add-deck-command"
              rows={3}
              maxLength={10_000}
              placeholder="e.g. npm run dev or git checkout {{branch}}"
              value={command}
              disabled={isSaving}
              required
              className="cd-input mt-1.5 p-2.5 font-mono text-[11px] leading-relaxed"
              onChange={(event) => setCommand(event.currentTarget.value)}
            />

            {parsedTemplate.isValid &&
              parsedTemplate.placeholders.length > 0 && (
                <div className="mt-2.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-2)] p-2.5">
                  <p className="text-[10px] font-medium text-[var(--text-subtle)]">
                    Template preview:
                  </p>
                  <div className="mt-1 font-mono text-[11px] text-[var(--text-primary)]">
                    <CommandTemplateHighlight parsed={parsedTemplate} />
                  </div>
                </div>
              )}
          </div>

          <div>
            <label
              htmlFor="add-deck-description"
              className="block text-[11px] font-medium text-[var(--text-muted)]"
            >
              Description (optional)
            </label>
            <input
              id="add-deck-description"
              type="text"
              maxLength={1000}
              placeholder="Brief summary of what this command does"
              value={description}
              disabled={isSaving}
              className="cd-input mt-1.5 h-9"
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
          </div>
        </div>

        <footer className="flex h-12 shrink-0 items-center justify-end gap-2 border-t border-[var(--border-soft)] bg-[var(--canvas-raised)] px-4">
          <button
            type="button"
            disabled={isSaving}
            className="cd-button cd-button--quiet h-8 px-3 text-[11px]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !command.trim()}
            className="cd-button cd-button--primary h-8 px-3 text-[11px]"
          >
            {isSaving ? 'Adding…' : 'Add Shortcut'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
