// src/config/index.ts
import { cosmiconfigSync } from 'cosmiconfig';
import { validateConfig, getDefaultModel } from './schema.js';
import type { ConfigType } from './schema.js';
import type { CLIOptions } from '../types/index.js';
import { getDefaultExclusions } from '../utils/patterns.js';

const MODULE_NAME = 'aiccommit';

// Constants for better maintainability and performance
const VALID_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;
const ENV_VAR_MAPPING = {
  provider: 'AIC_PROVIDER',
  model: 'AIC_MODEL',
  maxTokens: 'AIC_MAX_TOKENS',
  temperature: 'AIC_TEMPERATURE',
  defaultDescription: 'AIC_DEFAULT_DESCRIPTION',
} as const;

const API_KEY_ENV_MAPPING = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
} as const;

/**
 * Creates the default configuration object
 * Extracted for better testability and reusability
 */
function createDefaultConfig(): Partial<ConfigType> {
  return {
    provider: 'openai',
    maxTokens: 150,
    temperature: 0.3,
    excludePatterns: getDefaultExclusions(),
  };
}

/**
 * Loads configuration from config files using cosmiconfig
 * Handles errors gracefully and provides better error context
 */
function loadConfigFile(configPath?: string): Partial<ConfigType> {
  const explorer = cosmiconfigSync(MODULE_NAME, {
    searchPlaces: [
      'package.json',
      `.${MODULE_NAME}rc`,
      `.${MODULE_NAME}rc.json`,
      `.${MODULE_NAME}rc.js`,
      `.${MODULE_NAME}.config.js`,
      `${MODULE_NAME}.config.js`,
    ],
  });

  try {
    const result = explorer.search(configPath);
    return result?.config || {};
  } catch (error) {
    // Log warning but don't throw - let validation handle it
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        `Warning: Failed to load config file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
    return {};
  }
}

/**
 * Parses environment variables into config object
 * More efficient than repeated process.env lookups
 */
function loadEnvironmentConfig(): Partial<ConfigType> {
  const envConfig: Partial<ConfigType> = {};

  // Parse provider with validation
  const providerEnv = process.env[ENV_VAR_MAPPING.provider];
  if (providerEnv) {
    const provider = providerEnv.toLowerCase();
    if (
      VALID_PROVIDERS.includes(provider as (typeof VALID_PROVIDERS)[number])
    ) {
      envConfig.provider = provider as ConfigType['provider'];
    }
  }

  // Parse model
  const modelEnv = process.env[ENV_VAR_MAPPING.model];
  if (modelEnv) {
    envConfig.model = modelEnv;
  }

  // Parse numeric values with better error handling
  const maxTokensEnv = process.env[ENV_VAR_MAPPING.maxTokens];
  if (maxTokensEnv) {
    const maxTokens = Number.parseInt(maxTokensEnv, 10);
    if (Number.isFinite(maxTokens) && maxTokens > 0) {
      envConfig.maxTokens = maxTokens;
    }
  }

  const temperatureEnv = process.env[ENV_VAR_MAPPING.temperature];
  if (temperatureEnv) {
    const temperature = Number.parseFloat(temperatureEnv);
    if (Number.isFinite(temperature) && temperature >= 0 && temperature <= 2) {
      envConfig.temperature = temperature;
    }
  }

  // Parse default description
  const descriptionEnv = process.env[ENV_VAR_MAPPING.defaultDescription];
  if (descriptionEnv) {
    envConfig.defaultDescription = descriptionEnv;
  }

  // Collect API keys more efficiently
  const apiKeys: Record<string, string> = {};
  for (const [provider, envVar] of Object.entries(API_KEY_ENV_MAPPING)) {
    const key = process.env[envVar];
    if (key) {
      apiKeys[provider] = key;
    }
  }

  if (Object.keys(apiKeys).length > 0) {
    envConfig.apiKeys = apiKeys;
  }

  return envConfig;
}

/**
 * Applies CLI options to the configuration
 * Handles exclude patterns merging more efficiently
 */
function applyCLIOptions(
  config: Partial<ConfigType>,
  cliOptions: CLIOptions
): Partial<ConfigType> {
  const updatedConfig = { ...config };

  // Simple property mappings
  if (cliOptions.provider) {
    updatedConfig.provider = cliOptions.provider;
  }
  if (cliOptions.model) {
    updatedConfig.model = cliOptions.model;
  }
  if (cliOptions.maxTokens) {
    updatedConfig.maxTokens = cliOptions.maxTokens;
  }
  if (cliOptions.description) {
    updatedConfig.defaultDescription = cliOptions.description;
  }

  // Handle exclude patterns efficiently
  if (cliOptions.exclude?.length) {
    updatedConfig.excludePatterns = [
      ...(updatedConfig.excludePatterns || []),
      ...cliOptions.exclude,
    ];
  }

  return updatedConfig;
}

/**
 * Load configuration from various sources in priority order:
 * 1. CLI options (highest priority)
 * 2. Environment variables
 * 3. Config files (.aiccommit.json, .aiccommit.js, etc.)
 * 4. Default values (lowest priority)
 */
export function loadConfig(cliOptions: CLIOptions = {}): ConfigType {
  try {
    // Build configuration in layers
    let config = createDefaultConfig();
    config = { ...config, ...loadConfigFile(cliOptions.config) };
    config = { ...config, ...loadEnvironmentConfig() };
    config = applyCLIOptions(config, cliOptions);

    // Set default model if not specified
    if (!config.model && config.provider) {
      config.model = getDefaultModel(config.provider);
    }

    // Validate the final configuration
    const validation = validateConfig(config);
    if (!validation.success) {
      throw new Error(`Configuration validation failed: ${validation.error}`);
    }

    return validation.data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to load configuration: ${String(error)}`);
  }
}

/**
 * Get API key for the specified provider
 * Uses constants for better maintainability and type safety
 */
export function getApiKey(
  config: ConfigType,
  provider: string
): string | undefined {
  // First check config file API keys
  if (config.apiKeys?.[provider as keyof typeof config.apiKeys]) {
    return config.apiKeys[provider as keyof typeof config.apiKeys];
  }

  // Then check environment variables using mapping
  const envVar =
    API_KEY_ENV_MAPPING[provider as keyof typeof API_KEY_ENV_MAPPING];
  return envVar ? process.env[envVar] : undefined;
}

/**
 * Validate that required API key is available for the provider
 * Uses constants for better maintainability
 */
export function validateApiKey(config: ConfigType): {
  valid: boolean;
  error?: string;
} {
  const apiKey = getApiKey(config, config.provider);

  if (!apiKey) {
    const envVarName = API_KEY_ENV_MAPPING[config.provider];
    return {
      valid: false,
      error: `API key not found for ${config.provider}. Please set ${envVarName} environment variable or add it to your config file.`,
    };
  }

  return { valid: true };
}
