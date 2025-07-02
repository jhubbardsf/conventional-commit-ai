import type { AIProvider } from '../types/index.js';
import type { ConfigType } from '../config/schema.js';
import { getApiKey } from '../config/index.js';
import { OpenAIProvider } from './providers/openai.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { GeminiProvider } from './providers/gemini.js';

/**
 * Create an AI provider instance based on configuration
 */
export function createAIProvider(config: ConfigType): AIProvider {
  const apiKey = getApiKey(config, config.provider);

  if (!apiKey) {
    throw new Error(`API key not found for provider: ${config.provider}`);
  }

  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(
        apiKey,
        config.model,
        config.maxTokens,
        config.temperature
      );

    case 'anthropic':
      return new AnthropicProvider(
        apiKey,
        config.model,
        config.maxTokens,
        config.temperature
      );

    case 'gemini':
      return new GeminiProvider(
        apiKey,
        config.model,
        config.maxTokens,
        config.temperature
      );

    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}

/**
 * Get available models for a provider
 */
export function getAvailableModels(provider: string): string[] {
  switch (provider) {
    case 'openai':
      return OpenAIProvider.getAvailableModels();
    case 'anthropic':
      return AnthropicProvider.getAvailableModels();
    case 'gemini':
      return GeminiProvider.getAvailableModels();
    default:
      return [];
  }
}

/**
 * Check if a model is supported by a provider
 */
export function isModelSupported(provider: string, model: string): boolean {
  switch (provider) {
    case 'openai':
      return OpenAIProvider.isModelSupported(model);
    case 'anthropic':
      return AnthropicProvider.isModelSupported(model);
    case 'gemini':
      return GeminiProvider.isModelSupported(model);
    default:
      return false;
  }
}

/**
 * Get all supported providers
 */
export function getSupportedProviders(): string[] {
  return ['openai', 'anthropic', 'gemini'];
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(config: ConfigType): {
  valid: boolean;
  error?: string;
} {
  // Check if provider is supported
  if (!getSupportedProviders().includes(config.provider)) {
    return {
      valid: false,
      error: `Unsupported provider: ${
        config.provider
      }. Supported providers: ${getSupportedProviders().join(', ')}`,
    };
  }

  // Check if model is supported by the provider
  if (config.model && !isModelSupported(config.provider, config.model)) {
    const availableModels = getAvailableModels(config.provider);
    return {
      valid: false,
      error: `Model '${config.model}' is not supported by ${
        config.provider
      }. Available models: ${availableModels.join(', ')}`,
    };
  }

  // Check API key availability
  const apiKey = getApiKey(config, config.provider);
  if (!apiKey) {
    const envVarName = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      gemini: 'GEMINI_API_KEY',
    }[config.provider];

    return {
      valid: false,
      error: `API key not found for ${config.provider}. Please set ${envVarName} environment variable or add it to your config file.`,
    };
  }

  // Create provider instance to validate configuration
  try {
    const provider = createAIProvider(config);
    const isValid = provider.validateConfig();

    if (!isValid) {
      return {
        valid: false,
        error: `Invalid configuration for ${config.provider} provider.`,
      };
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        valid: false,
        error: `Provider validation failed: ${error.message}`,
      };
    }
    return {
      valid: false,
      error: 'Unknown provider validation error',
    };
  }

  return { valid: true };
}
