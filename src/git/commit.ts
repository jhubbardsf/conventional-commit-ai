import { simpleGit } from 'simple-git';

/**
 * Create a commit with the given message
 */
export async function createCommit(message: string): Promise<void> {
  const git = simpleGit();

  try {
    // Check if commit signing is enabled in git config
    const signingEnabled = await git.raw(['config', '--get', 'commit.gpgsign']).catch(() => 'false');

    if (signingEnabled.trim() === 'true') {
      // Use -S flag to sign the commit, respecting git's signing configuration
      await git.commit(message, undefined, { '-S': null });
    } else {
      await git.commit(message);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create commit: ${error.message}`);
    }
    throw new Error('Unknown commit error');
  }
}

/**
 * Get the last commit message for reference
 */
export async function getLastCommitMessage(): Promise<string | null> {
  const git = simpleGit();

  try {
    const log = await git.log({ maxCount: 1 });
    return log.latest?.message || null;
  } catch (error) {
    // Return null if we can't get the last commit (e.g., initial commit)
    return null;
  }
}

/**
 * Check if the working directory is clean (no uncommitted changes)
 */
export async function isWorkingDirectoryClean(): Promise<boolean> {
  const git = simpleGit();

  try {
    const status = await git.status();
    return status.isClean();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to check working directory status: ${error.message}`
      );
    }
    throw new Error('Unknown working directory status error');
  }
}

/**
 * Validate commit message follows conventional commit format
 */
export function validateConventionalCommit(message: string): {
  valid: boolean;
  error?: string;
} {
  // Basic conventional commit pattern: type(scope): description
  const conventionalPattern =
    /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?: .{1,50}/;

  if (!message.trim()) {
    return {
      valid: false,
      error: 'Commit message cannot be empty',
    };
  }

  if (!conventionalPattern.test(message)) {
    return {
      valid: false,
      error:
        'Commit message does not follow conventional commit format. Expected: type(scope): description',
    };
  }

  // Check for proper line length (first line should be <= 50 chars for best practices)
  const firstLine = message.split('\n')[0];
  if (firstLine && firstLine.length > 72) {
    return {
      valid: false,
      error: 'First line of commit message should be 72 characters or less',
    };
  }

  return { valid: true };
}

/**
 * Format a commit message to ensure it follows best practices
 */
export function formatCommitMessage(message: string): string {
  // Remove excessive whitespace and ensure proper formatting
  const lines = message.trim().split('\n');

  // Check if this is a detailed commit (has bullets after the first line)
  const isDetailedCommit = lines.some(
    (line, index) => index > 0 && line.trim().startsWith('-')
  );

  if (isDetailedCommit) {
    // For detailed commits, preserve structure but clean up lines
    const cleanedLines = lines.map((line) => line.trimEnd());

    // Remove empty lines at the beginning and end only
    while (
      cleanedLines.length > 0 &&
      cleanedLines[0] &&
      cleanedLines[0].trim() === ''
    ) {
      cleanedLines.shift();
    }
    while (
      cleanedLines.length > 0 &&
      cleanedLines[cleanedLines.length - 1] &&
      cleanedLines[cleanedLines.length - 1]!.trim() === ''
    ) {
      cleanedLines.pop();
    }

    // Ensure there's a blank line between header and bullets if not present
    if (
      cleanedLines.length >= 2 &&
      cleanedLines[0] &&
      cleanedLines[0].trim() !== '' &&
      cleanedLines[1] &&
      cleanedLines[1].trim().startsWith('-') &&
      cleanedLines[1].trim() !== ''
    ) {
      cleanedLines.splice(1, 0, '');
    }

    // Ensure the first line doesn't end with a period
    if (
      cleanedLines.length > 0 &&
      cleanedLines[0] &&
      cleanedLines[0].endsWith('.')
    ) {
      cleanedLines[0] = cleanedLines[0].slice(0, -1);
    }

    return cleanedLines.join('\n');
  } else {
    // For simple commits, use original logic
    const cleanedLines = lines.map((line) => line.trim());

    // Remove empty lines at the beginning and end
    while (cleanedLines.length > 0 && cleanedLines[0] === '') {
      cleanedLines.shift();
    }
    while (
      cleanedLines.length > 0 &&
      cleanedLines[cleanedLines.length - 1] === ''
    ) {
      cleanedLines.pop();
    }

    // Ensure the first line doesn't end with a period
    if (
      cleanedLines.length > 0 &&
      cleanedLines[0] &&
      cleanedLines[0].endsWith('.')
    ) {
      cleanedLines[0] = cleanedLines[0].slice(0, -1);
    }

    return cleanedLines.join('\n');
  }
}
