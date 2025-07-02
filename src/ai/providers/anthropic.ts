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
    description?: string,
    choices?: number,
    detailed?: boolean
  ): Promise<string> {
    try {
      const completion = await this.client.completions.create({
        model: this.model,
        max_tokens_to_sample: this.maxTokens,
        temperature: this.temperature,
        prompt: `${this.createSystemPrompt(choices, detailed)}\n\nHuman: ${this.createUserPrompt(diff, description)}\n\nAssistant:`,
      });

      if (!completion.completion) {
        throw new Error('Anthropic returned empty response');
      }

      // Handle detailed commits or multiple choices
      if (detailed || (choices && choices > 1)) {
        // For detailed commits, return the full response as-is
        // For multiple choices, also return full response (contains numbered options)
        return completion.completion.trim();
      }

      // Single choice, non-detailed - use original post-processing
      return this.postProcessMessage(completion.completion);
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
