import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type GitDiffResult = {
  diff: string;
  isStaged: boolean;
  hasChanges: boolean;
  error?: string;
};

export type GitCommitResult = {
  success: boolean;
  commitHash?: string;
  output?: string;
  error?: string;
};

export async function getWorkspaceGitDiff(cwd: string): Promise<GitDiffResult> {
  try {
    // 1. Try staged diff first
    const { stdout: stagedDiff } = await execFileAsync(
      'git',
      ['diff', '--staged'],
      {
        cwd,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    if (stagedDiff && stagedDiff.trim().length > 0) {
      return {
        diff: stagedDiff,
        isStaged: true,
        hasChanges: true,
      };
    }

    // 2. Fall back to unstaged diff
    const { stdout: unstagedDiff } = await execFileAsync('git', ['diff'], {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (unstagedDiff && unstagedDiff.trim().length > 0) {
      return {
        diff: unstagedDiff,
        isStaged: false,
        hasChanges: true,
      };
    }

    return {
      diff: '',
      isStaged: false,
      hasChanges: false,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('not a git repository')) {
      return {
        diff: '',
        isStaged: false,
        hasChanges: false,
        error: 'No Git repository detected in the current workspace directory.',
      };
    }
    return {
      diff: '',
      isStaged: false,
      hasChanges: false,
      error: `Failed to inspect Git diff: ${errorMsg}`,
    };
  }
}

export async function executeGitCommit(
  cwd: string,
  message: string,
): Promise<GitCommitResult> {
  if (!message || message.trim().length === 0) {
    return {
      success: false,
      error: 'Commit message cannot be empty.',
    };
  }

  try {
    const { stdout } = await execFileAsync(
      'git',
      ['commit', '-m', message.trim()],
      {
        cwd,
        maxBuffer: 5 * 1024 * 1024,
      },
    );

    return {
      success: true,
      output: stdout,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
