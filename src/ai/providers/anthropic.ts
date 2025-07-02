import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './base.js';

export class AnthropicProvider extends BaseAIProvider {
	name = 'anthropic';
	private client: Anthropic;

	constructor(
		apiKey: string,
		model: string = 'claude-3-sonnet-20240229',
		maxTokens: number = 150,
		temperature: number = 0.3
	) {
		super(apiKey, model, maxTokens, temperature);
		this.client = new Anthropic({
			apiKey: this.apiKey,
		});
	}

	async generateCommitMessage(
		diff: string,
		description?: string
	): Promise<string> {
		try {
			const response = await this.client.messages.create({
				model: this.model,
				max_tokens: this.maxTokens,
				temperature: this.temperature,
				system: this.createSystemPrompt(),
				messages: [
					{
						role: 'user',
						content: this.createUserPrompt(diff, description),
					},
				],
			});

			const content = response.content[0];
			if (content.type !== 'text' || !content.text) {
				throw new Error('Anthropic returned non-text response');
			}

			return this.postProcessMessage(content.text);
		} catch (error) {
			if (error instanceof Error) {
				// Handle specific Anthropic errors
				if (error.message.includes('invalid_api_key')) {
					throw new Error(
						'Invalid Anthropic API key. Please check your API key.'
					);
				}
				if (error.message.includes('insufficient_quota')) {
					throw new Error(
						'Anthropic API quota exceeded. Please check your billing settings.'
					);
				}
				if (error.message.includes('model_not_supported')) {
					throw new Error(
						`Anthropic model '${this.model}' not supported. Please check the model name.`
					);
				}
				if (error.message.includes('rate_limit')) {
					throw new Error(
						'Anthropic API rate limit exceeded. Please try again later.'
					);
				}
				throw new Error(`Anthropic API error: ${error.message}`);
			}
			throw new Error('Unknown Anthropic error');
		}
	}

	validateConfig(): boolean {
		if (!this.apiKey || this.apiKey.trim() === '') {
			return false;
		}

		if (!this.apiKey.startsWith('sk-ant-')) {
			return false;
		}

		return true;
	}

	/**
	 * Get available models for Anthropic
	 */
	static getAvailableModels(): string[] {
		return [
			'claude-3-opus-20240229',
			'claude-3-sonnet-20240229',
			'claude-3-haiku-20240307',
			'claude-3-5-sonnet-20241022',
			'claude-3-5-haiku-20241022',
		];
	}

	/**
	 * Validate if the model is supported
	 */
	static isModelSupported(model: string): boolean {
		return this.getAvailableModels().includes(model);
	}
}
