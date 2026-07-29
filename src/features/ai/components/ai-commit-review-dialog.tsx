'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Icon } from '@/components/ui/icon';
import { useSettings } from '@/features/settings/settings-provider';
import type { AICommitResult } from '../types';
import {
  executeGitCommitMessage,
  fetchWorkspaceGitDiff,
  generateAICommitMessage,
} from '../api';

type AICommitReviewDialogProps = {
  isOpen: boolean;
  workspacePath?: string;
  onClose: () => void;
  onOpenSettingsToAI?: () => void;
  onCommitSuccess?: (message: string) => void;
};

export function AICommitReviewDialog({
  isOpen,
  workspacePath,
  onClose,
  onOpenSettingsToAI,
  onCommitSuccess,
}: AICommitReviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { settings, updateSettings } = useSettings();

  const [stage, setStage] = useState<
    | 'checking'
    | 'no-key'
    | 'loading'
    | 'no-changes'
    | 'review'
    | 'committing'
    | 'error'
  >('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diffText, setDiffText] = useState<string>('');
  const [isStagedDiff, setIsStagedDiff] = useState<boolean>(false);

  const [aiResult, setAiResult] = useState<AICommitResult | null>(null);
  const [editedCommitMessage, setEditedCommitMessage] = useState<string>('');

  const generateCommit = useCallback(
    async (diff: string) => {
      setStage('loading');
      setErrorMessage(null);

      try {
        const result = await generateAICommitMessage(
          diff,
          settings.ai.provider,
          undefined,
          settings.ai.model,
        );
        setAiResult(result);
        setEditedCommitMessage(result.commitMessage);
        setStage('review');
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to generate AI commit message.',
        );
        setStage('error');
      }
    },
    [settings.ai.provider, settings.ai.model],
  );

  const startWorkflow = useCallback(async () => {
    setErrorMessage(null);
    setAiResult(null);

    // 1. Check API Key
    if (!settings.ai.hasApiKey) {
      setStage('no-key');
      return;
    }

    setStage('loading');

    try {
      // 2. Fetch Git Diff
      const diffResult = await fetchWorkspaceGitDiff(workspacePath);

      if (diffResult.error) {
        setErrorMessage(diffResult.error);
        setStage('error');
        return;
      }

      if (!diffResult.hasChanges || !diffResult.diff.trim()) {
        setStage('no-changes');
        return;
      }

      setDiffText(diffResult.diff);
      setIsStagedDiff(diffResult.isStaged);

      // 3. Generate AI Commit Message
      await generateCommit(diffResult.diff);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'An error occurred while inspecting Git diff.',
      );
      setStage('error');
    }
  }, [generateCommit, settings.ai.hasApiKey, workspacePath]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      void startWorkflow();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen, startWorkflow]);

  const handleRegenerate = () => {
    if (diffText) {
      void generateCommit(diffText);
    } else {
      void startWorkflow();
    }
  };

  const handleCommit = async () => {
    if (!editedCommitMessage.trim()) return;

    setStage('committing');
    setErrorMessage(null);

    try {
      const result = await executeGitCommitMessage(
        editedCommitMessage,
        workspacePath,
      );

      if (!result.success) {
        setErrorMessage(result.error || 'Git commit failed.');
        setStage('review');
        return;
      }

      onCommitSuccess?.(editedCommitMessage);
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to execute git commit.',
      );
      setStage('review');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="cd-dialog max-h-[calc(100dvh-2rem)] w-[min(38rem,calc(100vw-2rem))] rounded-lg p-0"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClose={() => {
        if (isOpen) onClose();
      }}
    >
      <div className="flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border-soft)] px-5">
          <div className="flex items-center gap-2.5">
            <span className="cd-clay-tile cd-clay-tile--accent flex size-7.5 items-center justify-center rounded-sm">
              <Icon name="sparkles" size={15} />
            </span>
            <div>
              <h2
                id={titleId}
                className="text-[14px] leading-5 font-semibold text-[var(--text-primary)]"
              >
                AI Commit Assistant
              </h2>
              <p className="text-[10px] leading-3 text-[var(--text-muted)]">
                {isStagedDiff
                  ? 'Using staged changes (git diff --staged)'
                  : 'Using working tree changes (git diff)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="cd-icon-button cd-button--quiet size-7.5 shrink-0 text-[var(--text-muted)]"
            onClick={onClose}
          >
            <Icon name="x" size={14} />
          </button>
        </header>

        {/* Content Body */}
        <div className="cd-scrollbar max-h-[calc(100dvh-10rem)] min-h-[14rem] overflow-y-auto p-5">
          {/* Missing API Key State */}
          {stage === 'no-key' && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <span className="cd-clay-tile cd-clay-tile--info mb-3 flex size-11 items-center justify-center rounded-lg">
                <Icon name="key" size={20} />
              </span>
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                Gemini API Key Required
              </h3>
              <p className="mt-1.5 max-w-[26rem] text-[11px] leading-4 text-[var(--text-muted)]">
                To use the AI Commit Assistant, please configure your Google
                Gemini API Key in Settings. Your API key is stored securely on
                your local device.
              </p>
              <div className="mt-5 flex gap-2.5">
                <button type="button" className="cd-button" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="cd-button cd-button--primary"
                  onClick={() => {
                    onClose();
                    onOpenSettingsToAI?.();
                  }}
                >
                  <Icon name="settings" size={13} />
                  Configure API Key
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {stage === 'loading' && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="mb-3 animate-spin text-[var(--accent)]">
                <Icon name="refresh" size={24} />
              </span>
              <h3 className="text-[13px] font-medium text-[var(--text-primary)]">
                Analyzing changes...
              </h3>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                Inspecting git diff and generating Conventional Commit summary
              </p>
            </div>
          )}

          {/* No Changes State */}
          {stage === 'no-changes' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="cd-clay-tile mb-3 flex size-10 items-center justify-center rounded-lg text-[var(--text-muted)]">
                <Icon name="branch" size={18} />
              </span>
              <h3 className="text-[13.5px] font-semibold text-[var(--text-primary)]">
                No Changes Detected
              </h3>
              <p className="mt-1 max-w-[24rem] text-[11px] leading-4 text-[var(--text-muted)]">
                There are no staged or unstaged modifications in this workspace
                directory to commit.
              </p>
              <button
                type="button"
                className="cd-button mt-4"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          )}

          {/* Error State */}
          {stage === 'error' && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <span className="mb-2.5 text-[var(--danger)]">
                <Icon name="alert" size={24} />
              </span>
              <h3 className="text-[13.5px] font-semibold text-[var(--danger)]">
                Unable to Generate Commit
              </h3>
              <p className="mt-1 max-w-[26rem] text-[11px] leading-4 text-[var(--text-muted)]">
                {errorMessage}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {errorMessage?.includes('no longer available') && (
                  <button
                    type="button"
                    className="cd-button cd-button--primary text-[11px]"
                    onClick={() => {
                      void updateSettings({
                        ai: { model: 'gemini-2.0-flash' },
                      });
                      setErrorMessage(
                        'Model setting updated to Gemini 2.0 Flash (Recommended). Click Retry to generate your commit message.',
                      );
                    }}
                  >
                    Switch to Recommended Model
                  </button>
                )}
                <button type="button" className="cd-button" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="cd-button cd-button--primary"
                  onClick={startWorkflow}
                >
                  <Icon name="refresh" size={13} />
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Review & Edit State */}
          {(stage === 'review' || stage === 'committing') && aiResult && (
            <div className="space-y-4">
              {aiResult.fallbackNotice && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] font-medium text-amber-400">
                  {aiResult.fallbackNotice}
                </div>
              )}

              {errorMessage && (
                <div className="rounded-md border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-2.5 text-[11px] text-[var(--danger)]">
                  {errorMessage}
                </div>
              )}

              {/* AI Summary */}
              <section className="rounded-md border border-[var(--border-soft)] bg-[var(--canvas-raised)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
                    AI Summary
                  </h4>
                  <span className="text-[9.5px] font-medium text-[var(--text-subtle)] uppercase">
                    {aiResult.provider}
                  </span>
                </div>
                <ul className="space-y-1.5 text-[11px] leading-4 text-[var(--text-primary)]">
                  {aiResult.summary.map((point, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-1 size-1 shrink-0 rounded-full bg-[var(--accent)]" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Commit Message Textarea */}
              <section>
                <label className="mb-1.5 block text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
                  Commit Message
                </label>
                <textarea
                  className="cd-input min-h-[4.5rem] w-full resize-y p-2.5 font-mono text-[11.5px] leading-5"
                  rows={3}
                  value={editedCommitMessage}
                  disabled={stage === 'committing'}
                  onChange={(e) => setEditedCommitMessage(e.target.value)}
                  placeholder="e.g. feat(scope): concise commit title"
                />
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                  You can edit the conventional commit message before
                  committing.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {(stage === 'review' || stage === 'committing') && (
          <footer className="flex shrink-0 items-center justify-between border-t border-[var(--border-soft)] px-5 py-3">
            <button
              type="button"
              className="cd-button cd-button--quiet"
              disabled={stage === 'committing'}
              onClick={handleRegenerate}
            >
              <Icon name="refresh" size={13} />
              Regenerate
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                className="cd-button"
                disabled={stage === 'committing'}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cd-button cd-button--primary"
                disabled={stage === 'committing' || !editedCommitMessage.trim()}
                onClick={handleCommit}
              >
                {stage === 'committing' ? (
                  <>
                    <span className="animate-spin">
                      <Icon name="refresh" size={13} />
                    </span>
                    Committing…
                  </>
                ) : (
                  <>
                    <Icon name="check" size={13} />
                    Commit
                  </>
                )}
              </button>
            </div>
          </footer>
        )}
      </div>
    </dialog>
  );
}
