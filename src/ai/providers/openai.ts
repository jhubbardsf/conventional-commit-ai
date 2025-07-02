import OpenAI from 'openai';
import { BaseAIProvider } from './base.js';

export class OpenAIProvider extends BaseAIProvider {
  name = 'openai';
  private client: OpenAI;

  constructor(
    apiKey: string,
    model: string = 'gpt-4',
    maxTokens: number = 150,
    temperature: number = 0.3
  ) {
    super(apiKey, model, maxTokens, temperature);
    this.client = new OpenAI({
      apiKey: this.apiKey,
    });
  }

  async generateCommitMessage(
    diff: string,
    description?: string
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.createSystemPrompt(),
          },
          {
            role: 'user',
            content: this.createUserPrompt(diff, description),
          },
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      const message = response.choices[0]?.message?.content;
      if (!message) {
        throw new Error('OpenAI returned empty response');
      }

      return this.postProcessMessage(message);
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific OpenAI errors
        if (error.message.includes('insufficient_quota')) {
          throw new Error(
            'OpenAI API quota exceeded. Please check your billing settings.'
          );
        }
        if (error.message.includes('invalid_api_key')) {
          throw new Error('Invalid OpenAI API key. Please check your API key.');
        }
        if (error.message.includes('model_not_found')) {
          throw new Error(
            `OpenAI model '${this.model}' not found. Please check the model name.`
          );
        }
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error('Unknown OpenAI error');
    }
  }

  validateConfig(): boolean {
    if (!this.apiKey || this.apiKey.trim() === '') {
      return false;
    }

    if (!this.apiKey.startsWith('sk-')) {
      return false;
    }

    return true;
  }

  /**
   * Get available models for OpenAI
   */
  static getAvailableModels(): string[] {
    return [
      'gpt-4',
      'gpt-4-turbo-preview',
      'gpt-4-0125-preview',
      'gpt-4-1106-preview',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-0125',
      'gpt-3.5-turbo-1106',
    ];
  }

  /**
   * Validate if the model is supported
   */
  static isModelSupported(model: string): boolean {
    return this.getAvailableModels().includes(model);
  }
}
