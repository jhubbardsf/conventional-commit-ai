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
    description?: string,
    choices?: number,
    detailed?: boolean
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.createSystemPrompt(choices, detailed),
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

      // Handle detailed commits or multiple choices
      if (detailed || (choices && choices > 1)) {
        // For detailed commits, return the full response as-is
        // For multiple choices, also return full response (contains numbered options)
        return message.trim();
      }

      // Single choice, non-detailed - use original post-processing
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

}
