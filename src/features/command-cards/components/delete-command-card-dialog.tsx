'use client';

import { useEffect, useRef } from 'react';

type DeleteCommandCardDialogProps = {
  command: string;
  isOpen: boolean;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteCommandCardDialog({
  command,
  isOpen,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: DeleteCommandCardDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-white/12 bg-[#0b1018] p-0 text-slate-200 shadow-2xl shadow-black/60 backdrop:bg-black/70"
      aria-labelledby="delete-command-card-title"
      onCancel={(event) => {
        if (isDeleting) {
          event.preventDefault();
        } else {
          onCancel();
        }
      }}
      onClose={() => {
        if (isOpen && !isDeleting) {
          onCancel();
        }
      }}
    >
      <div className="p-5">
        <h3
          id="delete-command-card-title"
          className="text-sm font-semibold text-slate-100"
        >
          Delete this command card?
        </h3>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          This permanently removes it from local history.
        </p>
        <pre className="mt-4 max-h-32 overflow-auto rounded-lg border border-white/8 bg-black/20 p-3 font-mono text-xs leading-5 break-words whitespace-pre-wrap text-slate-300">
          {command}
        </pre>

        {error && (
          <p className="mt-3 text-xs text-rose-300" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:outline-none disabled:opacity-50"
            disabled={isDeleting}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-xs text-rose-200 transition-colors hover:bg-rose-300/15 focus-visible:ring-2 focus-visible:ring-rose-300/70 focus-visible:outline-none disabled:opacity-50"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? 'Deleting…' : 'Delete card'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
