import { z } from 'zod';

export const ConfigSchema = z.object({
	provider: z.enum(['openai', 'anthropic', 'gemini']).default('openai'),
	model: z.string().optional(),
	maxTokens: z.number().min(1).max(4000).default(150),
	temperature: z.number().min(0).max(2).default(0.3),
	excludePatterns: z.array(z.string()).default([]),
	defaultDescription: z.string().optional(),
	apiKeys: z
		.object({
			openai: z.string().optional(),
			anthropic: z.string().optional(),
			gemini: z.string().optional(),
		})
		.optional(),
});

export type ConfigType = z.infer<typeof ConfigSchema>;

export const DEFAULT_MODELS = {
	openai: 'gpt-4',
	anthropic: 'claude-3-sonnet-20240229',
	gemini: 'gemini-pro',
} as const;

export function getDefaultModel(
	provider: 'openai' | 'anthropic' | 'gemini'
): string {
	return DEFAULT_MODELS[provider];
}

export function validateConfig(
	config: unknown
): { success: true; data: ConfigType } | { success: false; error: string } {
	try {
		const result = ConfigSchema.parse(config);
		return { success: true, data: result };
	} catch (error) {
		if (error instanceof z.ZodError) {
			const issues = error.issues
				.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
				.join(', ');
			return {
				success: false,
				error: `Configuration validation failed: ${issues}`,
			};
		}
		return { success: false, error: 'Unknown configuration validation error' };
	}
}
