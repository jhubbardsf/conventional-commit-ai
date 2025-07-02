import { simpleGit } from 'simple-git';
import type { GitDiffResult } from '../types/index.js';
import { filterExcludedFiles } from '../utils/patterns.js';

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

		// Apply exclusion patterns
		const filteredFiles = filterExcludedFiles(stagedFiles, excludePatterns);

		if (filteredFiles.length === 0) {
			return {
				files: stagedFiles,
				diff: '',
				hasChanges: false,
			};
		}

		// Get diff for staged files
		const diff = await git.diff([
			'--cached',
			'--no-color',
			'--unified=3',
			...filteredFiles,
		]);

		return {
			files: filteredFiles,
			diff: diff.trim(),
			hasChanges: diff.trim().length > 0,
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
