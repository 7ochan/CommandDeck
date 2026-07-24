'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import {
  expandCommandTemplate,
  parseCommandTemplate,
  previewCommandTemplate,
} from '@/shared/command-template';

type ExecuteCommandTemplateDialogProps = {
  displayName: string;
  template: string;
  isOpen: boolean;
  onCancel: () => void;
  onExecute: (command: string) => boolean;
};

export function ExecuteCommandTemplateDialog({
  displayName,
  template,
  isOpen,
  onCancel,
  onExecute,
}: ExecuteCommandTemplateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const titleId = useId();
  const parsed = useMemo(() => parseCommandTemplate(template), [template]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const preview = previewCommandTemplate(template, values);
  const allValuesPresent = parsed.placeholders.every(
    ({ name }) => values[name]?.trim().length,
  );

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      setValues({});
      setError(null);
      dialog.showModal();
      const firstPlaceholder = parsed.placeholders[0];
      const focusFrame = requestAnimationFrame(() => {
        if (firstPlaceholder) {
          inputRefs.current.get(firstPlaceholder.name)?.focus();
        }
      });

      return () => cancelAnimationFrame(focusFrame);
    }

    if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen, parsed.placeholders]);

  const execute = () => {
    const result = expandCommandTemplate(template, values);

    if (!result.ok) {
      setError(
        result.errors[0]?.message ??
          'Complete every placeholder before running this command.',
      );
      return;
    }

    if (!onExecute(result.command)) {
      setError('The active terminal is not connected.');
      return;
    }

    onCancel();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    execute();
  };

  const advanceOrExecute = (
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    const nextPlaceholder = parsed.placeholders[index + 1];

    if (nextPlaceholder) {
      inputRefs.current.get(nextPlaceholder.name)?.focus();
    } else {
      execute();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-cyan-300/15 bg-[#0b1018] p-0 text-slate-200 shadow-2xl shadow-black/60 backdrop:bg-black/70"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClose={() => {
        if (isOpen) {
          onCancel();
        }
      }}
    >
      <form className="p-5" onSubmit={submit}>
        <h3 id={titleId} className="text-sm font-semibold text-slate-100">
          Run {displayName}
        </h3>
        <p className="mt-1.5 text-xs leading-5 text-slate-400">
          Fill each variable. Values are used only for this execution.
        </p>

        <div className="mt-4 space-y-3">
          {parsed.placeholders.map((placeholder, index) => (
            <label
              key={placeholder.name}
              className="block text-[11px] text-slate-400"
            >
              <span className="flex items-center justify-between gap-3">
                <span>{placeholder.label}</span>
                <span className="font-mono text-[9px] text-slate-600">
                  {placeholder.token}
                </span>
              </span>
              <input
                ref={(input) => {
                  if (input) {
                    inputRefs.current.set(placeholder.name, input);
                  } else {
                    inputRefs.current.delete(placeholder.name);
                  }
                }}
                required
                autoComplete="off"
                value={values[placeholder.name] ?? ''}
                placeholder={placeholder.token}
                className="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-700 focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/10"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setValues((currentValues) => ({
                    ...currentValues,
                    [placeholder.name]: value,
                  }));
                  setError(null);
                }}
                onKeyDown={(event) => advanceOrExecute(event, index)}
              />
            </label>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-white/8 bg-black/20 p-3">
          <span className="text-[10px] font-medium text-slate-500">
            Command preview
          </span>
          <pre className="mt-2 max-h-36 overflow-auto font-mono text-[11px] leading-5 break-words whitespace-pre-wrap text-slate-300">
            {preview}
          </pre>
        </div>

        {error && (
          <p className="mt-3 text-xs text-rose-300" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:outline-none"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-300/15 focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!allValuesPresent}
          >
            Run command
          </button>
        </div>
      </form>
    </dialog>
  );
}
