import { minimatch } from 'minimatch';

/**
 * Check if a file path matches any of the given exclusion patterns
 */
export function isFileExcluded(filePath: string, patterns: string[]): boolean {
	if (!patterns || patterns.length === 0) {
		return false;
	}

	return patterns.some((pattern) => {
		// Normalize the pattern and file path for consistent matching
		const normalizedPattern = pattern.replace(/\\/g, '/');
		const normalizedPath = filePath.replace(/\\/g, '/');

		return minimatch(normalizedPath, normalizedPattern, {
			dot: true, // Include dotfiles
			matchBase: true, // Match basename against pattern
		});
	});
}

/**
 * Filter an array of file paths by exclusion patterns
 */
export function filterExcludedFiles(
	files: string[],
	patterns: string[]
): string[] {
	if (!patterns || patterns.length === 0) {
		return files;
	}

	return files.filter((file) => !isFileExcluded(file, patterns));
}

/**
 * Validate exclusion patterns to ensure they're valid glob patterns
 */
export function validatePatterns(patterns: string[]): {
	valid: string[];
	invalid: string[];
} {
	const valid: string[] = [];
	const invalid: string[] = [];

	for (const pattern of patterns) {
		try {
			// Test the pattern with a dummy file path
			minimatch('test/file.js', pattern);
			valid.push(pattern);
		} catch (error) {
			invalid.push(pattern);
		}
	}

	return { valid, invalid };
}

/**
 * Common exclusion patterns for different project types
 */
export const COMMON_EXCLUSIONS = {
	// Build and distribution files
	build: ['dist/**', 'build/**', 'out/**', '.next/**', '.nuxt/**'],

	// Dependencies
	dependencies: ['node_modules/**', 'vendor/**', 'bower_components/**'],

	// Version control
	vcs: ['.git/**', '.svn/**', '.hg/**'],

	// IDE and editor files
	editors: ['.vscode/**', '.idea/**', '*.swp', '*.swo', '*~'],

	// OS files
	os: ['.DS_Store', 'Thumbs.db', 'desktop.ini'],

	// Logs and temporary files
	temp: ['*.log', '*.tmp', '*.temp', '.cache/**', '.temp/**'],

	// Test files (optional, user might want to include these)
	tests: ['**/*.test.*', '**/*.spec.*', '__tests__/**', 'tests/**'],

	// Documentation (optional)
	docs: ['docs/**', '*.md', 'README*', 'CHANGELOG*', 'LICENSE*'],

	// Configuration files (optional)
	config: [
		'*.config.*',
		'.env*',
		'tsconfig.json',
		'package-lock.json',
		'yarn.lock',
		'bun.lockb',
	],
};

/**
 * Get default exclusion patterns
 */
export function getDefaultExclusions(): string[] {
	return [
		...COMMON_EXCLUSIONS.build,
		...COMMON_EXCLUSIONS.dependencies,
		...COMMON_EXCLUSIONS.vcs,
		...COMMON_EXCLUSIONS.editors,
		...COMMON_EXCLUSIONS.os,
		...COMMON_EXCLUSIONS.temp,
	];
}
