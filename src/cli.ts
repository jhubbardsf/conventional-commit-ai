#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig, validateApiKey } from './config/index.js';
import { createAIProvider, validateProviderConfig } from './ai/index.js';
import { getStagedDiff, validateRepository } from './git/diff.js';
import {
  createCommit,
  validateConventionalCommit,
  formatCommitMessage,
} from './git/commit.js';
import { logger, LogLevel } from './utils/logger.js';
import { validatePatterns } from './utils/patterns.js';
import type { CLIOptions } from './types/index.js';

const program = new Command();

program
  .name('aic-commit')
  .description('AI-powered conventional commit message generator')
  .version('1.0.0');

program
  .option(
    '-d, --description <text>',
    'Additional context for the AI to generate better commit messages'
  )
  .option(
    '-x, --exclude <patterns...>',
    'File patterns to exclude from the diff (supports glob patterns)'
  )
  .option('--config <path>', 'Path to custom configuration file')
  .option('--model <model>', 'AI model to use (overrides config)')
  .option(
    '--provider <provider>',
    'AI provider to use: openai, anthropic, gemini (overrides config)',
    /^(openai|anthropic|gemini)$/
  )
  .option(
    '--max-tokens <number>',
    'Maximum tokens for AI response (overrides config)',
    (value) => {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 4000) {
        throw new Error('max-tokens must be a number between 1 and 4000');
      }
      return parsed;
    }
  )
  .option('--dry-run', 'Generate commit message without actually committing')
  .option('-v, --verbose', 'Show detailed progress information')
  .option('--debug', 'Show debug information including API requests/responses')
  .option('-q, --quiet', 'Suppress all output except errors')
  .option('--json', 'Output results in JSON format')
  .action(async (options: CLIOptions) => {
    try {
      await runCLI(options);
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error('Unknown error occurred');
      }
      process.exit(1);
    }
  });

async function runCLI(options: CLIOptions): Promise<void> {
  // Configure logger based on options
  if (options.quiet) {
    logger.setLevel(LogLevel.ERROR);
  } else if (options.debug) {
    logger.setLevel(LogLevel.DEBUG);
  } else if (options.verbose) {
    logger.setLevel(LogLevel.VERBOSE);
  }

  if (options.json) {
    logger.setJsonMode(true);
  }

  logger.verbose('Starting AI conventional commit generator');

  // Validate repository
  logger.progress('Validating git repository');
  const repoValidation = await validateRepository();
  if (!repoValidation.valid) {
    logger.progressFailed('Repository validation failed');
    throw new Error(repoValidation.error);
  }
  logger.progressDone('Repository validated');

  // Load configuration
  logger.progress('Loading configuration');
  let config;
  try {
    config = loadConfig(options);
    logger.progressDone('Configuration loaded');
  } catch (error) {
    logger.progressFailed('Configuration loading failed');
    throw error;
  }

  logger.verbose(`Using provider: ${config.provider}`);
  logger.verbose(`Using model: ${config.model}`);

  // Validate patterns if provided
  if (options.exclude && options.exclude.length > 0) {
    const patternValidation = validatePatterns(options.exclude);
    if (patternValidation.invalid.length > 0) {
      logger.warn(
        `Invalid exclusion patterns: ${patternValidation.invalid.join(', ')}`
      );
    }
  }

  // Validate API key
  logger.progress('Validating API configuration');
  const apiKeyValidation = validateApiKey(config);
  if (!apiKeyValidation.valid) {
    logger.progressFailed('API key validation failed');
    throw new Error(apiKeyValidation.error);
  }

  // Validate provider configuration
  const providerValidation = validateProviderConfig(config);
  if (!providerValidation.valid) {
    logger.progressFailed('Provider configuration validation failed');
    throw new Error(providerValidation.error);
  }
  logger.progressDone('API configuration validated');

  // Get staged diff
  logger.progress('Analyzing staged changes');
  const diffResult = await getStagedDiff(config.excludePatterns);

  if (!diffResult.hasChanges) {
    logger.progressFailed('No changes to commit');

    if (diffResult.files.length === 0) {
      throw new Error(
        'No staged files found. Please stage your changes with "git add" before running this command.'
      );
    } else {
      throw new Error(
        `All staged files (${diffResult.files.length}) were excluded by patterns. Please adjust your exclusion patterns.`
      );
    }
  }

  logger.progressDone('Changes analyzed');
  logger.verbose(`Found ${diffResult.files.length} staged files`);
  logger.debug('Staged files:', diffResult.files);

  // Create AI provider
  logger.progress('Initializing AI provider');
  const aiProvider = createAIProvider(config);
  logger.progressDone(`${config.provider} provider initialized`);

  // Generate commit message
  logger.progress('Generating commit message');
  let commitMessage;
  try {
    commitMessage = await aiProvider.generateCommitMessage(
      diffResult.diff,
      options.description || config.defaultDescription
    );
    logger.progressDone('Commit message generated');
  } catch (error) {
    logger.progressFailed('Commit message generation failed');
    throw error;
  }

  // Format and validate the commit message
  const formattedMessage = formatCommitMessage(commitMessage);
  const messageValidation = validateConventionalCommit(formattedMessage);

  if (!messageValidation.valid) {
    logger.warn(
      `Generated message may not follow conventional commit format: ${messageValidation.error}`
    );
    logger.warn('Using the message anyway...');
  }

  // Output the result
  if (options.json) {
    const result = {
      message: formattedMessage,
      provider: config.provider,
      model: config.model,
      files: diffResult.files,
      dryRun: options.dryRun || false,
    };
    console.log(JSON.stringify(result, null, 2));
  } else {
    logger.info('Generated commit message:');
    console.log(`\n${formattedMessage}\n`);

    if (diffResult.files.length > 0) {
      logger.info(`Files to be committed: ${diffResult.files.join(', ')}`);
    }
  }

  // Commit or dry run
  if (options.dryRun) {
    logger.info('Dry run mode - no commit was made');
  } else {
    logger.progress('Creating commit');
    try {
      await createCommit(formattedMessage);
      logger.progressDone('Commit created successfully');
      logger.success('Commit created with AI-generated message');
    } catch (error) {
      logger.progressFailed('Commit creation failed');
      throw error;
    }
  }

  logger.verbose('AI conventional commit generator completed successfully');
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(
    'Unhandled rejection:',
    reason instanceof Error ? reason.message : String(reason)
  );
  process.exit(1);
});

// Parse command line arguments
program.parse();
