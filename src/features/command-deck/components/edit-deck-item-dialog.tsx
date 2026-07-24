'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import type { CommandDeckItem, CommandDeckItemUpdate } from '../types';

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
            disabled={isSaving || !displayName.trim() || !command.trim()}
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
