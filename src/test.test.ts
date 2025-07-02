import { test, expect } from 'bun:test';
import {
  validateConventionalCommit,
  formatCommitMessage,
} from './git/commit.js';
import { isFileExcluded, filterExcludedFiles } from './utils/patterns.js';
import { LogLevel, Logger } from './utils/logger.js';
import { isNoiseFile, optimizeDiff } from './git/diff.js';

test('validateConventionalCommit - valid messages', () => {
  const validMessages = [
    'feat: add user authentication',
    'fix: resolve null pointer exception',
    'docs: update installation guide',
    'style: format code with prettier',
    'refactor: simplify user service',
    'perf: optimize database queries',
    'test: add unit tests for auth',
    'chore: update dependencies',
    'ci: add github actions workflow',
    'build: configure webpack',
    'revert: revert previous commit',
    'feat(auth): add login functionality',
    'fix(api): handle edge case in validation',
  ];

  for (const message of validMessages) {
    const result = validateConventionalCommit(message);
    expect(result.valid).toBe(true);
  }
});

test('validateConventionalCommit - invalid messages', () => {
  const invalidMessages = [
    '', // empty
    'Add user authentication', // no type
    'feat add user auth', // missing colon
    'unknown: add feature', // invalid type
    'feat: ' + 'x'.repeat(100), // too long
  ];

  for (const message of invalidMessages) {
    const result = validateConventionalCommit(message);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  }
});

test('formatCommitMessage - formatting', () => {
  expect(formatCommitMessage('feat: add feature.')).toBe('feat: add feature');
  expect(formatCommitMessage('  feat: add feature  ')).toBe(
    'feat: add feature'
  );
  expect(formatCommitMessage('feat: add feature\n\n')).toBe(
    'feat: add feature'
  );
  expect(formatCommitMessage('feat: add feature\n\nDetailed description')).toBe(
    'feat: add feature\n\nDetailed description'
  );
});

test('isFileExcluded - pattern matching', () => {
  const patterns = ['*.test.js', '*.spec.ts', 'docs/**', 'node_modules/**'];

  expect(isFileExcluded('app.test.js', patterns)).toBe(true);
  expect(isFileExcluded('utils.spec.ts', patterns)).toBe(true);
  expect(isFileExcluded('docs/readme.md', patterns)).toBe(true);
  expect(isFileExcluded('node_modules/package/index.js', patterns)).toBe(true);

  expect(isFileExcluded('app.js', patterns)).toBe(false);
  expect(isFileExcluded('utils.ts', patterns)).toBe(false);
  expect(isFileExcluded('src/index.js', patterns)).toBe(false);
});

test('filterExcludedFiles - filtering', () => {
  const files = [
    'src/index.js',
    'src/utils.js',
    'src/app.test.js',
    'docs/readme.md',
    'package.json',
  ];

  const patterns = ['*.test.js', 'docs/**'];
  const filtered = filterExcludedFiles(files, patterns);

  expect(filtered).toEqual(['src/index.js', 'src/utils.js', 'package.json']);
});

test('Logger - levels', () => {
  const logger = new Logger(LogLevel.WARN);

  // This test mainly ensures the logger doesn't throw errors
  // In a real scenario, you'd want to capture console output
  expect(() => {
    logger.error('Test error');
    logger.warn('Test warning');
    logger.info('Test info'); // Should not log due to level
    logger.debug('Test debug'); // Should not log due to level
  }).not.toThrow();
});

test('Token optimization - noise file filtering', () => {
  // Test actual noise file detection patterns
  expect(isNoiseFile('package-lock.json')).toBe(true);
  expect(isNoiseFile('yarn.lock')).toBe(true);
  expect(isNoiseFile('bun.lock')).toBe(true);
  expect(isNoiseFile('styles.min.css')).toBe(true);
  expect(isNoiseFile('bundle.js')).toBe(true);
  expect(isNoiseFile('app.map')).toBe(true);
  expect(isNoiseFile('.vscode/settings.json')).toBe(true);
  expect(isNoiseFile('.idea/workspace.xml')).toBe(true);
  expect(isNoiseFile('component.generated.ts')).toBe(true);

  // Test that normal files are not filtered
  expect(isNoiseFile('src/index.ts')).toBe(false);
  expect(isNoiseFile('README.md')).toBe(false);
  expect(isNoiseFile('package.json')).toBe(false);
  expect(isNoiseFile('src/utils.js')).toBe(false);
});

test('Token optimization - diff optimization', () => {
  // Test diff optimization with whitespace and comment filtering
  const mockDiff = `diff --git a/src/test.js b/src/test.js
index 1234567..abcdefg 100644
--- a/src/test.js
+++ b/src/test.js
@@ -1,7 +1,7 @@
 function test() {
-  // Old comment
+  // New comment
   const x = 1;
-	const y = 2;
+  const y = 2;


   return x + y;
 }`;

  const optimized = optimizeDiff(mockDiff);

  // Should preserve essential structure
  expect(optimized).toContain('diff --git');
  expect(optimized).toContain('function test()');
  expect(optimized).toContain('const x = 1;');
  expect(optimized).toContain('return x + y;');

  // Should filter out whitespace-only changes (tab to spaces conversion)
  expect(optimized).not.toContain('\tconst y = 2;'); // Tab version should be filtered
  expect(optimized).not.toContain('  const y = 2;'); // Space version should be filtered too since it's paired

  // Should have fewer lines than original due to filtering
  expect(optimized.split('\n').length).toBeLessThan(
    mockDiff.split('\n').length
  );
});

test('Token optimization - whitespace compression', () => {
  const diffWithExcessiveWhitespace = `diff --git a/src/test.js b/src/test.js
@@ -1,5 +1,5 @@
 function test() {



   return true;



 }`;

  const optimized = optimizeDiff(diffWithExcessiveWhitespace);

  // Should compress multiple blank lines to single blank line
  const blankLineCount = (optimized.match(/^\s*$/gm) || []).length;
  expect(blankLineCount).toBeLessThanOrEqual(2); // Should be compressed
});
