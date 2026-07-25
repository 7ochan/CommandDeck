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
import { Icon } from '@/components/ui/icon';

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
      className="cd-dialog w-[min(32rem,calc(100vw-1.5rem))] p-0"
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
      <form className="p-5 sm:p-6" onSubmit={submit}>
        <div className="flex items-start gap-3">
          <span className="cd-empty-mark size-9 shrink-0 text-[var(--accent)]">
            <Icon name="play" size={17} />
          </span>
          <div>
            <h3
              id={titleId}
              className="text-[15px] font-semibold text-[var(--text-primary)]"
            >
              Run {displayName}
            </h3>
            <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
              Values are used only for this execution.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {parsed.placeholders.map((placeholder, index) => (
            <label
              key={placeholder.name}
              className="block text-[12px] font-medium text-[var(--text-secondary)]"
            >
              <span className="flex items-center justify-between gap-3">
                <span>{placeholder.label}</span>
                <span className="font-mono text-[10px] font-normal text-[var(--text-muted)]">
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
                className="cd-input mt-1.5 h-10 px-3 font-mono text-[12px] font-normal"
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

        <div className="mt-5 rounded-[10px] border border-[var(--border)] bg-[var(--canvas-raised)] p-3.5">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
            Command preview
          </span>
          <pre className="cd-scrollbar mt-2 max-h-36 overflow-auto font-mono text-[11px] leading-5 break-words whitespace-pre-wrap text-[var(--text-secondary)]">
            {preview}
          </pre>
        </div>

        {error && (
          <p className="mt-3 text-[12px] text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="cd-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="cd-button cd-button--primary"
            disabled={!allValuesPresent}
          >
            <Icon name="play" size={14} />
            Run command
          </button>
        </div>
      </form>
    </dialog>
  );
}
