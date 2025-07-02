import { simpleGit } from 'simple-git';

/**
 * Create a commit with the given message
 */
export async function createCommit(message: string): Promise<void> {
	const git = simpleGit();

	try {
		await git.commit(message);
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
	const lines = message
		.trim()
		.split('\n')
		.map((line) => line.trim());

	// Remove empty lines at the beginning and end
	while (lines.length > 0 && lines[0] === '') {
		lines.shift();
	}
	while (lines.length > 0 && lines[lines.length - 1] === '') {
		lines.pop();
	}

	// Ensure the first line doesn't end with a period
	if (lines.length > 0 && lines[0] && lines[0].endsWith('.')) {
		lines[0] = lines[0].slice(0, -1);
	}

	return lines.join('\n');
}
