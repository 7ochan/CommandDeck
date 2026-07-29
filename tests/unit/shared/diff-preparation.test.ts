import { describe, expect, it } from 'vitest';
import { prepareDiffForAI } from '../../../src/features/ai/diff-preparation';

describe('DiffPreparation Utility', () => {
  it('preserves small diffs intact without truncation', () => {
    const smallDiff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
 import React from 'react';
+import { App } from './App';
 console.log('hello');`;

    const result = prepareDiffForAI(smallDiff);
    expect(result.isTruncated).toBe(false);
    expect(result.fileCount).toBe(1);
    expect(result.totalInsertions).toBe(1);
    expect(result.totalDeletions).toBe(0);
    expect(result.preparedDiff).toBe(smallDiff);
  });

  it('intelligently truncates large file diffs while preserving filenames and line boundaries', () => {
    const largeLines: string[] = [];
    largeLines.push('diff --git a/src/big-file.ts b/src/big-file.ts');
    largeLines.push('--- a/src/big-file.ts');
    largeLines.push('+++ b/src/big-file.ts');
    largeLines.push('@@ -1,1000 +1,2000 @@');
    for (let i = 0; i < 200; i++) {
      largeLines.push(`+const addedVar${i} = "value ${i}"; // Line ${i}`);
    }

    const largeDiff = largeLines.join('\n');
    // Set overall budget high (8000) so Strategy 1 (file-level truncation) is used
    const result = prepareDiffForAI(largeDiff, 8000);

    expect(result.isTruncated).toBe(true);
    expect(result.fileCount).toBe(1);
    expect(result.totalInsertions).toBe(200);
    expect(result.preparedDiff).toContain('src/big-file.ts');
    expect(result.preparedDiff).toContain(
      '[Truncated remaining changes for src/big-file.ts]',
    );
  });

  it('generates repository change statistics for massive multi-file diffs', () => {
    const multiFileDiffs: string[] = [];
    for (let i = 0; i < 30; i++) {
      multiFileDiffs.push(`diff --git a/src/file${i}.ts b/src/file${i}.ts
--- a/src/file${i}.ts
+++ b/src/file${i}.ts
@@ -1,1 +1,20 @@
+export const value${i} = ${i};
+export const name${i} = "name_${i}";`);
    }

    const massiveDiff = multiFileDiffs.join('\n');
    const result = prepareDiffForAI(massiveDiff, 1000);

    expect(result.isTruncated).toBe(true);
    expect(result.fileCount).toBe(30);
    expect(result.preparedDiff).toContain('Repository Change Statistics:');
    expect(result.preparedDiff).toContain('Total Files Changed: 30');
    expect(result.preparedDiff).toContain('Changed File List:');
    expect(result.preparedDiff).toContain(
      '[Note: Diff exceeded token budget. Summary and representative samples provided.]',
    );
  });
});
