export interface AIProvider {
  name: string;
  generateCommitMessage(
    diff: string,
    description?: string,
    choices?: number
  ): Promise<string>;
  validateConfig(): boolean;
}

export interface Config {
  provider: 'openai' | 'anthropic' | 'gemini';
  model?: string;
  maxTokens?: number;
  temperature?: number;
  excludePatterns?: string[];
  defaultDescription?: string;
  apiKeys?: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
  };
}

export interface CLIOptions {
  description?: string;
  exclude?: string[];
  config?: string;
  model?: string;
  provider?: 'openai' | 'anthropic' | 'gemini';
  maxTokens?: number;
  choices?: number;
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
