#!/usr/bin/env node

import { Command } from 'commander';
import * as readline from 'readline';
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
  .option(
    '--choices <number>',
    'Generate multiple commit message options to choose from (2-5)',
    (value) => {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed < 2 || parsed > 5) {
        throw new Error('choices must be a number between 2 and 5');
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

  // Generate commit message(s)
  const progressMessage =
    options.choices && options.choices > 1
      ? 'Generating commit message options'
      : 'Generating commit message';
  logger.progress(progressMessage);

  let commitMessage;
  try {
    commitMessage = await aiProvider.generateCommitMessage(
      diffResult.diff,
      options.description || config.defaultDescription,
      options.choices
    );
    logger.progressDone(
      options.choices && options.choices > 1
        ? 'Commit message options generated'
        : 'Commit message generated'
    );
  } catch (error) {
    logger.progressFailed('Commit message generation failed');
    throw error;
  }

  // Handle multiple choices
  let selectedMessage = commitMessage;
  let allChoices: string[] = [];

  if (options.choices && options.choices > 1) {
    // Parse the numbered choices from the response
    allChoices = commitMessage
      .split('\n')
      .map((line) => {
        const match = line.match(/^\d+\.\s*(.+)$/);
        return match ? match[1] : '';
      })
      .filter((choice): choice is string => choice.length > 0);

    if (allChoices.length === 0) {
      throw new Error('Failed to parse multiple choices from AI response');
    }

    // In dry-run or JSON mode, just show all options
    if (options.dryRun || options.json) {
      selectedMessage = commitMessage; // Keep the formatted list
    } else {
      // Interactive selection
      selectedMessage = await selectCommitMessage(allChoices, options.quiet);
    }
  }

  // Handle output based on mode
  let displayMessage: string;
  let messageForValidation: string;

  if (options.choices && options.choices > 1) {
    if (options.dryRun || options.json) {
      // In dry-run or JSON mode, show all options
      displayMessage = selectedMessage; // This contains the full numbered list
      messageForValidation = allChoices[0] || selectedMessage; // Validate the first option or fallback
    } else {
      // Interactive mode - user selected one option
      displayMessage = selectedMessage;
      messageForValidation = selectedMessage;
    }
  } else {
    // Single choice mode
    displayMessage = selectedMessage;
    messageForValidation = selectedMessage;
  }

  const formattedMessage = formatCommitMessage(messageForValidation);
  const messageValidation = validateConventionalCommit(formattedMessage);

  if (!messageValidation.valid && !options.dryRun) {
    logger.warn(
      `Generated message may not follow conventional commit format: ${messageValidation.error}`
    );
    logger.warn('Using the message anyway...');
  }

  // Output the result
  if (options.json) {
    const result = {
      message:
        options.choices && options.choices > 1
          ? displayMessage
          : formattedMessage,
      provider: config.provider,
      model: config.model,
      files: diffResult.files,
      dryRun: options.dryRun || false,
    };
    console.log(JSON.stringify(result, null, 2));
  } else {
    logger.info('Generated commit message:');
    if (options.choices && options.choices > 1 && options.dryRun) {
      // Show all options in dry-run mode
      console.log(`\n${displayMessage}\n`);
    } else {
      // Show single formatted message
      console.log(`\n${formattedMessage}\n`);
    }

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

/**
 * Interactive selection of commit message from multiple options
 */
async function selectCommitMessage(
  choices: string[],
  quiet: boolean = false
): Promise<string> {
  if (choices.length === 1) {
    return choices[0];
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (!quiet) {
      console.log('\nChoose your commit message:');
      choices.forEach((choice, index) => {
        console.log(`${index + 1}. ${choice}`);
      });
      console.log('');
    }

    const askForChoice = (): void => {
      rl.question(`Select option (1-${choices.length}): `, (answer) => {
        const choice = parseInt(answer, 10);

        if (isNaN(choice) || choice < 1 || choice > choices.length) {
          console.log(`Please enter a number between 1 and ${choices.length}`);
          askForChoice();
          return;
        }

        const selectedChoice = choices[choice - 1];
        if (selectedChoice !== undefined) {
          rl.close();
          resolve(selectedChoice);
        } else {
          console.log('Invalid selection. Please try again.');
          askForChoice();
        }
      });
    };

    askForChoice();
  });
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
