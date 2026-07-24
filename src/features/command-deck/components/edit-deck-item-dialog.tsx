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

import type { CommandDeckItem, CommandDeckItemUpdate } from '../types';
import { CommandTemplateHighlight } from './command-template-highlight';

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
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-white/12 bg-[#0b1018] p-0 text-slate-200 shadow-2xl shadow-black/60 backdrop:bg-black/70"
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
      <form className="p-5" onSubmit={(event) => void submit(event)}>
        <h3 id={titleId} className="text-sm font-semibold text-slate-100">
          Edit Command Deck item
        </h3>
        <p className="mt-1.5 text-xs leading-5 text-slate-400">
          Changes apply only to the Deck. The source History entry stays intact.
        </p>

        <label className="mt-4 block text-[11px] text-slate-400">
          Display name
          <input
            required
            maxLength={120}
            value={displayName}
            className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-slate-200 outline-none focus:border-emerald-300/45 focus:ring-2 focus:ring-emerald-300/10"
            onChange={(event) => setDisplayName(event.currentTarget.value)}
          />
        </label>

        <label className="mt-3 block text-[11px] text-slate-400">
          Command
          <textarea
            required
            maxLength={10_000}
            rows={4}
            value={command}
            className="mt-1.5 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs leading-5 text-slate-200 outline-none focus:border-emerald-300/45 focus:ring-2 focus:ring-emerald-300/10"
            onChange={(event) => setCommand(event.currentTarget.value)}
          />
        </label>

        <div
          className={`mt-2 rounded-lg border p-3 ${
            parsedTemplate.isValid
              ? 'border-cyan-300/12 bg-cyan-300/4'
              : 'border-rose-300/20 bg-rose-300/5'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-medium text-slate-400">
              Template detection
            </span>
            <span className="font-mono text-[9px] text-slate-600">
              {parsedTemplate.placeholders.length === 0
                ? 'Runs immediately'
                : `${parsedTemplate.placeholders.length} variable${
                    parsedTemplate.placeholders.length === 1 ? '' : 's'
                  }`}
            </span>
          </div>
          <pre className="mt-2 max-h-28 overflow-auto font-mono text-[11px] leading-5 break-words whitespace-pre-wrap text-slate-300">
            <CommandTemplateHighlight parsed={parsedTemplate} />
          </pre>
          {parsedTemplate.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-[10px] leading-4 text-rose-300">
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

        <label className="mt-3 block text-[11px] text-slate-400">
          Description <span className="text-slate-600">(optional)</span>
          <textarea
            maxLength={1_000}
            rows={3}
            value={description}
            className="mt-1.5 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-200 outline-none focus:border-emerald-300/45 focus:ring-2 focus:ring-emerald-300/10"
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>

        {error && (
          <p className="mt-3 text-xs text-rose-300" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:outline-none disabled:opacity-50"
            disabled={isSaving}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-300/15 focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:outline-none disabled:opacity-50"
            disabled={
              isSaving ||
              !displayName.trim() ||
              !command.trim() ||
              !parsedTemplate.isValid
            }
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
