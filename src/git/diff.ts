import { simpleGit } from 'simple-git';
import type { GitDiffResult } from '../types/index.js';
import { filterExcludedFiles } from '../utils/patterns.js';

/**
 * Patterns for auto-generated files and noise that should be filtered out
 */
const NOISE_PATTERNS = [
  // Build outputs
  /\.map$/,
  /\.min\.(js|css)$/,
  /bundle\.(js|css)$/,

  // Lock files
  /package-lock\.json$/,
  /yarn\.lock$/,
  /bun\.lock$/,
  /pnpm-lock\.yaml$/,

  // Generated files
  /\.generated\./,
  /\.gen\./,
  /\.auto\./,

  // IDE files
  /\.vscode\//,
  /\.idea\//,
];

/**
 * Check if a file is likely auto-generated or noise
 */
export function isNoiseFile(filename: string): boolean {
  return NOISE_PATTERNS.some((pattern) => pattern.test(filename));
}

/**
 * Remove whitespace-only changes and compress whitespace in diff
 */
export function optimizeDiff(diff: string): string {
  const lines = diff.split('\n');
  const optimizedLines: string[] = [];

  let consecutiveBlankLines = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue; // Skip undefined lines
    }

    // Skip diff headers and file info
    if (
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('+++') ||
      line.startsWith('---')
    ) {
      optimizedLines.push(line);
      consecutiveBlankLines = 0;
      i++;
      continue;
    }

    // Handle hunk headers
    if (line.startsWith('@@')) {
      optimizedLines.push(line);
      consecutiveBlankLines = 0;
      i++;
      continue;
    }

    // Check for paired whitespace-only changes (- line followed by + line with same content)
    if (
      line.startsWith('-') &&
      i + 1 < lines.length &&
      lines[i + 1]?.startsWith('+')
    ) {
      const nextLine = lines[i + 1];
      if (nextLine) {
        const removedContent = line.slice(1);
        const addedContent = nextLine.slice(1);

        // If the trimmed content is identical, it's a pure whitespace change
        if (
          removedContent.trim() === addedContent.trim() &&
          removedContent.trim() !== ''
        ) {
          // Skip both lines (whitespace-only change)
          i += 2;
          continue;
        }
      }
    }

    // Skip comment-only changes
    if (isCommentOnlyChange(line)) {
      i++;
      continue;
    }

    // Compress consecutive blank lines (limit to 1 blank line)
    if (isBlankLine(line)) {
      consecutiveBlankLines++;
      if (consecutiveBlankLines <= 1) {
        optimizedLines.push(line);
      }
      i++;
      continue;
    } else {
      consecutiveBlankLines = 0;
    }

    // Normalize whitespace for non-blank lines
    optimizedLines.push(normalizeWhitespace(line));
    i++;
  }

  return optimizedLines.join('\n');
}

/**
 * Check if a line is only a comment change
 */
function isCommentOnlyChange(line: string): boolean {
  if (!line.startsWith('+') && !line.startsWith('-')) {
    return false;
  }

  const content = line.slice(1).trim();

  // Common comment patterns
  const commentPatterns = [
    /^\/\//, // JavaScript/TypeScript single line
    /^\/\*/, // JavaScript/TypeScript block start
    /^\*/, // JavaScript/TypeScript block middle
    /^\*\//, // JavaScript/TypeScript block end
    /^#/, // Python/Shell/Ruby
    /^<!--/, // HTML
    /^\/\/\//, // Documentation comments
  ];

  return commentPatterns.some((pattern) => pattern.test(content));
}

/**
 * Check if a line is blank or whitespace only
 */
function isBlankLine(line: string): boolean {
  return line.trim() === '' || /^[\s]*$/.test(line);
}

/**
 * Normalize whitespace in a line
 */
function normalizeWhitespace(line: string): string {
  if (!line.startsWith('+') && !line.startsWith('-') && !line.startsWith(' ')) {
    return line;
  }

  // Preserve the diff prefix
  const prefix = line.charAt(0);
  const content = line.slice(1);

  // Don't normalize if it's already minimal
  if (content.length < 100) {
    return line;
  }

  // Remove trailing whitespace and compress multiple spaces (but preserve indentation)
  const normalized = content
    .replace(/\s+$/, '') // Remove trailing whitespace
    .replace(/  +/g, ' '); // Compress multiple spaces to single space (except leading)

  return prefix + normalized;
}

/**
 * Get staged files and their diff content
 */
export async function getStagedDiff(
  excludePatterns: string[] = []
): Promise<GitDiffResult> {
  const git = simpleGit();

  try {
    // Check if we're in a git repository
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error(
        'Not a git repository. Please run this command from within a git repository.'
      );
    }

    // Get staged files
    const status = await git.status();
    const stagedFiles = [
      ...status.staged,
      ...status.modified.filter((file) => status.staged.includes(file)),
    ];

    if (stagedFiles.length === 0) {
      return {
        files: [],
        diff: '',
        hasChanges: false,
      };
    }

    // Apply exclusion patterns and filter noise files
    let filteredFiles = filterExcludedFiles(stagedFiles, excludePatterns);

    // Additional filtering for auto-generated/noise files to reduce tokens
    filteredFiles = filteredFiles.filter((file) => !isNoiseFile(file));

    if (filteredFiles.length === 0) {
      return {
        files: stagedFiles,
        diff: '',
        hasChanges: false,
      };
    }

    // Get diff for staged files with reduced context lines for token optimization
    const diff = await git.diff([
      '--cached',
      '--no-color',
      '--unified=1', // Reduced from 3 to 1 for ~66% token reduction
      ...filteredFiles,
    ]);

    // Apply diff optimizations to reduce token usage
    const optimizedDiff = optimizeDiff(diff);

    return {
      files: filteredFiles,
      diff: optimizedDiff.trim(),
      hasChanges: optimizedDiff.trim().length > 0,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Git operation failed: ${error.message}`);
    }
    throw new Error('Unknown git operation error');
  }
}

/**
 * Check if there are any staged changes
 */
export async function hasStagedChanges(): Promise<boolean> {
  const git = simpleGit();

  try {
    const status = await git.status();
    return status.staged.length > 0;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to check git status: ${error.message}`);
    }
    throw new Error('Unknown git status error');
  }
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(): Promise<string> {
  const git = simpleGit();

  try {
    const branchSummary = await git.branch();
    return branchSummary.current;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get current branch: ${error.message}`);
    }
    throw new Error('Unknown branch error');
  }
}

/**
 * Check repository status and validate it's ready for commit
 */
export async function validateRepository(): Promise<{
  valid: boolean;
  error?: string;
}> {
  const git = simpleGit();

  try {
    // Check if we're in a git repository
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return {
        valid: false,
        error:
          'Not a git repository. Please run this command from within a git repository.',
      };
    }

    // Check if there are staged changes
    const hasStaged = await hasStagedChanges();
    if (!hasStaged) {
      return {
        valid: false,
        error:
          'No staged changes found. Please stage your changes with "git add" before running this command.',
      };
    }

    return { valid: true };
  } catch (error) {
    if (error instanceof Error) {
      return {
        valid: false,
        error: `Repository validation failed: ${error.message}`,
      };
    }
    return {
      valid: false,
      error: 'Unknown repository validation error',
    };
  }
}
