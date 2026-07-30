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

import type { CommandDeckItem, CommandDeckItemUpdate } from '../types.ts';
import { CommandTemplateHighlight } from './command-template-highlight.tsx';

type EditDeckItemDialogProps = {
  item: CommandDeckItem;
  isOpen: boolean;
  onCancel: () => void;
  onSave: (update: CommandDeckItemUpdate) => Promise<void>;
};

export function EditDeckItemDialog({
  item,
  isOpen,
  onCancel,
  onSave,
}: EditDeckItemDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [displayName, setDisplayName] = useState(item.displayName);
  const [command, setCommand] = useState(item.command);
  const [description, setDescription] = useState(item.description ?? '');
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
      setDisplayName(item.displayName);
      setCommand(item.command);
      setDescription(item.description ?? '');
      setError(null);
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen, item]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
      await onSave({
        displayName: displayName.trim(),
        command,
        description: description.trim() || null,
      });
      onCancel();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save Deck item.',
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
      onClose={() => {
        if (isOpen && !isSaving) {
          onCancel();
        }
      }}
    >
      <form className="p-5 sm:p-6" onSubmit={(event) => void submit(event)}>
        <div className="flex items-start gap-3">
          <span className="cd-empty-mark size-9 shrink-0">
            <Icon name="edit" size={17} />
          </span>
          <div>
            <h3
              id={titleId}
              className="text-[15px] font-semibold text-[var(--text-primary)]"
            >
              Edit Deck item
            </h3>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
              Changes apply only to the Deck. Source History stays intact.
            </p>
          </div>
        </div>

        <label className="mt-5 block text-[12px] font-medium text-[var(--text-secondary)]">
          Display name
          <input
            required
            maxLength={120}
            value={displayName}
            className="cd-input mt-1.5 h-10 px-3 text-[12px] font-normal"
            onChange={(event) => setDisplayName(event.currentTarget.value)}
          />
        </label>

        <label className="mt-4 block text-[12px] font-medium text-[var(--text-secondary)]">
          Command
          <textarea
            required
            maxLength={10_000}
            rows={4}
            value={command}
            className="cd-input mt-1.5 w-full resize-y px-3 py-2.5 font-mono text-[12px] leading-5 font-normal"
            onChange={(event) => setCommand(event.currentTarget.value)}
          />
        </label>

        <div
          className={`mt-2.5 rounded-[10px] border p-3.5 ${
            parsedTemplate.isValid
              ? 'border-[var(--border)] bg-[var(--canvas-raised)]'
              : 'border-[rgb(239_141_152_/_24%)] bg-[var(--danger-soft)]'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
              Template detection
            </span>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              {parsedTemplate.placeholders.length === 0
                ? 'Runs immediately'
                : `${parsedTemplate.placeholders.length} variable${
                    parsedTemplate.placeholders.length === 1 ? '' : 's'
                  }`}
            </span>
          </div>
          <pre className="cd-scrollbar mt-2 max-h-28 overflow-auto font-mono text-[11px] leading-5 break-words whitespace-pre-wrap text-[var(--text-secondary)]">
            <CommandTemplateHighlight parsed={parsedTemplate} />
          </pre>
          {parsedTemplate.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] leading-4 text-[var(--danger)]">
              {parsedTemplate.errors.map((templateError, index) => (
                <li
                  key={`${templateError.code}:${templateError.start}:${index}`}
                >
                  {templateError.message}
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="mt-4 block text-[12px] font-medium text-[var(--text-secondary)]">
          Description{' '}
          <span className="font-normal text-[var(--text-muted)]">
            (optional)
          </span>
          <textarea
            maxLength={1_000}
            rows={3}
            value={description}
            className="cd-input mt-1.5 w-full resize-y px-3 py-2.5 text-[12px] leading-5 font-normal"
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>

        {error && (
          <p className="mt-3 text-[12px] text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="cd-button"
            disabled={isSaving}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="cd-button cd-button--primary"
            disabled={
              isSaving ||
              !displayName.trim() ||
              !command.trim() ||
              !parsedTemplate.isValid
            }
          >
            <Icon name="check" size={14} />
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
