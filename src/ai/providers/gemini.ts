import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAIProvider } from './base.js';

export class GeminiProvider extends BaseAIProvider {
	name = 'gemini';
	private client: GoogleGenerativeAI;

	constructor(
		apiKey: string,
		model: string = 'gemini-pro',
		maxTokens: number = 150,
		temperature: number = 0.3
	) {
		super(apiKey, model, maxTokens, temperature);
		this.client = new GoogleGenerativeAI(this.apiKey);
	}

	async generateCommitMessage(
		diff: string,
		description?: string
	): Promise<string> {
		try {
			const model = this.client.getGenerativeModel({
				model: this.model,
				generationConfig: {
					maxOutputTokens: this.maxTokens,
					temperature: this.temperature,
				},
			});

			const prompt = `${this.createSystemPrompt()}\n\n${this.createUserPrompt(
				diff,
				description
			)}`;

			const result = await model.generateContent(prompt);
			const response = await result.response;
			const text = response.text();

			if (!text) {
				throw new Error('Gemini returned empty response');
			}

			return this.postProcessMessage(text);
		} catch (error) {
			if (error instanceof Error) {
				// Handle specific Gemini errors
				if (error.message.includes('API_KEY_INVALID')) {
					throw new Error('Invalid Gemini API key. Please check your API key.');
				}
				if (error.message.includes('QUOTA_EXCEEDED')) {
					throw new Error(
						'Gemini API quota exceeded. Please check your billing settings.'
					);
				}
				if (error.message.includes('MODEL_NOT_FOUND')) {
					throw new Error(
						`Gemini model '${this.model}' not found. Please check the model name.`
					);
				}
				if (error.message.includes('RATE_LIMIT_EXCEEDED')) {
					throw new Error(
						'Gemini API rate limit exceeded. Please try again later.'
					);
				}
				throw new Error(`Gemini API error: ${error.message}`);
			}
			throw new Error('Unknown Gemini error');
		}
	}

	validateConfig(): boolean {
		if (!this.apiKey || this.apiKey.trim() === '') {
			return false;
		}

		// Gemini API keys are typically alphanumeric strings
		if (this.apiKey.length < 30) {
			return false;
		}

		return true;
	}

	/**
	 * Get available models for Gemini
	 */
	static getAvailableModels(): string[] {
		return [
			'gemini-pro',
			'gemini-pro-latest',
			'gemini-1.5-pro',
			'gemini-1.5-pro-latest',
			'gemini-1.5-flash',
			'gemini-1.5-flash-latest',
		];
	}

	/**
	 * Validate if the model is supported
	 */
	static isModelSupported(model: string): boolean {
		return this.getAvailableModels().includes(model);
	}
}
