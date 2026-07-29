export type PreparedDiffResult = {
  preparedDiff: string;
  isTruncated: boolean;
  fileCount: number;
  totalInsertions: number;
  totalDeletions: number;
};

const TARGET_MAX_CHAR_LENGTH = 12_000;
const MAX_FILE_CHAR_LENGTH = 2_500;

type ParsedFileDiff = {
  fileName: string;
  status: 'Added' | 'Deleted' | 'Renamed' | 'Modified';
  headerLines: string[];
  changedLines: string[];
  insertions: number;
  deletions: number;
  rawText: string;
};

export function prepareDiffForAI(
  rawDiff: string,
  maxLength: number = TARGET_MAX_CHAR_LENGTH,
): PreparedDiffResult {
  if (!rawDiff || rawDiff.trim().length === 0) {
    return {
      preparedDiff: '',
      isTruncated: false,
      fileCount: 0,
      totalInsertions: 0,
      totalDeletions: 0,
    };
  }

  // If raw diff is reasonably small, return as-is
  if (rawDiff.length <= maxLength) {
    const parsedFiles = parseGitDiffFiles(rawDiff);
    let totalInsertions = 0;
    let totalDeletions = 0;
    for (const f of parsedFiles) {
      totalInsertions += f.insertions;
      totalDeletions += f.deletions;
    }
    return {
      preparedDiff: rawDiff,
      isTruncated: false,
      fileCount: parsedFiles.length,
      totalInsertions,
      totalDeletions,
    };
  }

  // Intelligently process large diff
  const files = parseGitDiffFiles(rawDiff);
  let totalInsertions = 0;
  let totalDeletions = 0;
  for (const f of files) {
    totalInsertions += f.insertions;
    totalDeletions += f.deletions;
  }

  // Strategy 1: Filter out large unchanged context lines & trim file diffs
  const trimmedBlocks: string[] = [];

  for (const file of files) {
    const fileHeader = `--- ${file.fileName} [${file.status}] (+${file.insertions}, -${file.deletions}) ---`;
    const condensedContent = file.changedLines.join('\n');

    if (condensedContent.length > MAX_FILE_CHAR_LENGTH) {
      const truncatedLines = file.changedLines
        .join('\n')
        .slice(0, MAX_FILE_CHAR_LENGTH)
        .split('\n');
      // Drop last potentially incomplete line boundary
      if (truncatedLines.length > 1) {
        truncatedLines.pop();
      }
      trimmedBlocks.push(
        `${fileHeader}\n${truncatedLines.join('\n')}\n... [Truncated remaining changes for ${file.fileName}]`,
      );
    } else {
      trimmedBlocks.push(`${fileHeader}\n${condensedContent}`);
    }
  }

  let prepared = trimmedBlocks.join('\n\n');

  // Strategy 2: If still exceeds max length (e.g. 50+ files), build structured summary + samples
  if (prepared.length > maxLength) {
    const summaryHeader = `Repository Change Statistics:
- Total Files Changed: ${files.length}
- Total Insertions (+): ${totalInsertions}
- Total Deletions (-): ${totalDeletions}

Changed File List:
${files.map((f) => `- [${f.status}] ${f.fileName} (+${f.insertions}, -${f.deletions})`).join('\n')}

Representative Diff Samples (Truncated for size):`;

    const sampleBlocks: string[] = [];
    let currentLength = summaryHeader.length;

    for (const file of files) {
      const sample = `--- ${file.fileName} [${file.status}] ---\n${file.changedLines.slice(0, 25).join('\n')}`;
      if (currentLength + sample.length > maxLength - 200) {
        break;
      }
      sampleBlocks.push(sample);
      currentLength += sample.length;
    }

    prepared = `${summaryHeader}\n\n${sampleBlocks.join('\n\n')}\n\n[Note: Diff exceeded token budget. Summary and representative samples provided.]`;
  }

  return {
    preparedDiff: prepared,
    isTruncated: true,
    fileCount: files.length,
    totalInsertions,
    totalDeletions,
  };
}

function parseGitDiffFiles(rawDiff: string): ParsedFileDiff[] {
  const lines = rawDiff.split(/\r?\n/);
  const files: ParsedFileDiff[] = [];
  let currentFile: ParsedFileDiff | null = null;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      if (currentFile) {
        files.push(currentFile);
      }

      // Extract filename from "diff --git a/path/file b/path/file"
      const parts = line.split(' ');
      let fileName = 'unknown';
      if (parts.length >= 4) {
        fileName = parts[3].replace(/^b\//, '');
      } else if (parts.length >= 3) {
        fileName = parts[2].replace(/^a\//, '');
      }

      currentFile = {
        fileName,
        status: 'Modified',
        headerLines: [line],
        changedLines: [],
        insertions: 0,
        deletions: 0,
        rawText: line,
      };
      continue;
    }

    if (!currentFile) {
      continue;
    }

    currentFile.rawText += '\n' + line;

    if (line.startsWith('new file mode')) {
      currentFile.status = 'Added';
    } else if (line.startsWith('deleted file mode')) {
      currentFile.status = 'Deleted';
    } else if (
      line.startsWith('similarity index') ||
      line.startsWith('rename from')
    ) {
      currentFile.status = 'Renamed';
    }

    if (
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('index ')
    ) {
      currentFile.headerLines.push(line);
      continue;
    }

    // Capture additions, deletions, and hunk headers
    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentFile.insertions++;
      currentFile.changedLines.push(line);
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      currentFile.deletions++;
      currentFile.changedLines.push(line);
    } else if (line.startsWith('@@ ')) {
      currentFile.changedLines.push(line);
    }
  }

  if (currentFile) {
    files.push(currentFile);
  }

  return files;
}
