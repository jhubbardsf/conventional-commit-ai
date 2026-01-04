export interface AIProvider {
  name: string;
  generateCommitMessage(
    diff: string,
    description?: string,
    choices?: number,
    detailed?: boolean
  ): Promise<string>;
  /**
   * Generic generation method with custom prompts
   * Used for PR descriptions and other non-commit use cases
   */
  generate(systemPrompt: string, userPrompt: string): Promise<string>;
  validateConfig(): boolean;
}

export interface Config {
  provider: 'openai' | 'anthropic' | 'gemini' | 'zai';
  model?: string;
  maxTokens?: number;
  temperature?: number;
  excludePatterns?: string[];
  defaultDescription?: string;
  apiKeys?: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
    zai?: string;
  };
}

export interface CLIOptions {
  description?: string;
  exclude?: string[];
  config?: string;
  model?: string;
  provider?: 'openai' | 'anthropic' | 'gemini' | 'zai';
  maxTokens?: number;
  choices?: number;
  detailed?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  debug?: boolean;
  quiet?: boolean;
  json?: boolean;
}

export interface CommitMessageResult {
  message: string;
  provider: string;
  model: string;
  tokensUsed?: number;
}

export interface GitDiffResult {
  files: string[];
  diff: string;
  hasChanges: boolean;
}

export interface PRCLIOptions {
  base: string;
  description?: string;
  clipboard: boolean;
  exclude?: string[];
  config?: string;
  model?: string;
  provider?: 'openai' | 'anthropic' | 'gemini' | 'zai';
  maxTokens?: number;
  verbose?: boolean;
  debug?: boolean;
  quiet?: boolean;
  json?: boolean;
}

export interface PRGenerationResult {
  description: string;
  provider: string;
  model: string;
  baseBranch: string;
  currentBranch: string;
  filesChanged: string[];
}
