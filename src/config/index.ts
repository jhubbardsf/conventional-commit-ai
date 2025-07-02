import { cosmiconfigSync } from 'cosmiconfig';
import { validateConfig, getDefaultModel } from './schema.js';
import type { ConfigType } from './schema.js';
import type { CLIOptions } from '../types/index.js';
import { getDefaultExclusions } from '../utils/patterns.js';

const moduleName = 'aiccommit';

/**
 * Load configuration from various sources in priority order:
 * 1. CLI options
 * 2. Environment variables
 * 3. Config files (.aiccommit.json, .aiccommit.js, etc.)
 * 4. Default values
 */
export function loadConfig(cliOptions: CLIOptions = {}): ConfigType {
	// Start with default configuration
	let config: Partial<ConfigType> = {
		provider: 'openai',
		maxTokens: 150,
		temperature: 0.3,
		excludePatterns: getDefaultExclusions(),
	};

	// Load from config file
	const explorer = cosmiconfigSync(moduleName, {
		searchPlaces: [
			'package.json',
			`.${moduleName}rc`,
			`.${moduleName}rc.json`,
			`.${moduleName}rc.js`,
			`.${moduleName}.config.js`,
			`${moduleName}.config.js`,
		],
	});

	try {
		const result = explorer.search(cliOptions.config);
		if (result && result.config) {
			config = { ...config, ...result.config };
		}
	} catch (error) {
		// Config file errors will be handled by validation
	}

	// Load from environment variables
	const envConfig: Partial<ConfigType> = {};

	if (process.env.AIC_PROVIDER) {
		const provider = process.env.AIC_PROVIDER.toLowerCase();
		if (['openai', 'anthropic', 'gemini'].includes(provider)) {
			envConfig.provider = provider as 'openai' | 'anthropic' | 'gemini';
		}
	}

	if (process.env.AIC_MODEL) {
		envConfig.model = process.env.AIC_MODEL;
	}

	if (process.env.AIC_MAX_TOKENS) {
		const maxTokens = parseInt(process.env.AIC_MAX_TOKENS, 10);
		if (!isNaN(maxTokens)) {
			envConfig.maxTokens = maxTokens;
		}
	}

	if (process.env.AIC_TEMPERATURE) {
		const temperature = parseFloat(process.env.AIC_TEMPERATURE);
		if (!isNaN(temperature)) {
			envConfig.temperature = temperature;
		}
	}

	if (process.env.AIC_DEFAULT_DESCRIPTION) {
		envConfig.defaultDescription = process.env.AIC_DEFAULT_DESCRIPTION;
	}

	// Collect API keys from environment
	const apiKeys: Record<string, string> = {};
	if (process.env.OPENAI_API_KEY) {
		apiKeys.openai = process.env.OPENAI_API_KEY;
	}
	if (process.env.ANTHROPIC_API_KEY) {
		apiKeys.anthropic = process.env.ANTHROPIC_API_KEY;
	}
	if (process.env.GEMINI_API_KEY) {
		apiKeys.gemini = process.env.GEMINI_API_KEY;
	}
	if (Object.keys(apiKeys).length > 0) {
		envConfig.apiKeys = apiKeys;
	}

	// Merge environment config
	config = { ...config, ...envConfig };

	// Apply CLI options (highest priority)
	if (cliOptions.provider) {
		config.provider = cliOptions.provider;
	}
	if (cliOptions.model) {
		config.model = cliOptions.model;
	}
	if (cliOptions.description) {
		config.defaultDescription = cliOptions.description;
	}
	if (cliOptions.exclude && cliOptions.exclude.length > 0) {
		config.excludePatterns = [
			...(config.excludePatterns || []),
			...cliOptions.exclude,
		];
	}

	// Set default model if not specified
	if (!config.model && config.provider) {
		config.model = getDefaultModel(config.provider);
	}

	// Validate the final configuration
	const validation = validateConfig(config);
	if (!validation.success) {
		throw new Error(validation.error);
	}

	return validation.data;
}

/**
 * Get API key for the specified provider
 */
export function getApiKey(
	config: ConfigType,
	provider: string
): string | undefined {
	// First check config file API keys
	if (
		config.apiKeys &&
		config.apiKeys[provider as keyof typeof config.apiKeys]
	) {
		return config.apiKeys[provider as keyof typeof config.apiKeys];
	}

	// Then check environment variables
	switch (provider) {
		case 'openai':
			return process.env.OPENAI_API_KEY;
		case 'anthropic':
			return process.env.ANTHROPIC_API_KEY;
		case 'gemini':
			return process.env.GEMINI_API_KEY;
		default:
			return undefined;
	}
}

/**
 * Validate that required API key is available for the provider
 */
export function validateApiKey(config: ConfigType): {
	valid: boolean;
	error?: string;
} {
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

	return { valid: true };
}
