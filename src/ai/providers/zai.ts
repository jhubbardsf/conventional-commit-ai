import OpenAI from 'openai';
import { OpenAIProvider } from './openai.js';

export class ZAIProvider extends OpenAIProvider {
  override name = 'zai';

  constructor(
    apiKey: string,
    model: string = 'glm-4.6',
    maxTokens: number = 150,
    temperature: number = 0.3
  ) {
    super(apiKey, model, maxTokens, temperature);
    // Override the client with ZAI's base URL
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: 'https://api.z.ai/api/paas/v4/',
    });
  }

  override async generateCommitMessage(
    diff: string,
    description?: string,
    choices?: number,
    detailed?: boolean
  ): Promise<string> {
    const isDebug = process.env.DEBUG === 'true' || process.env.AIC_DEBUG === 'true';

    if (isDebug) {
      console.error('\n[ZAI Debug] Request Details:');
      console.error(`  Provider: ${this.name}`);
      console.error(`  Base URL: https://api.z.ai/api/paas/v4/`);
      console.error(`  Model: ${this.model}`);
      console.error(`  Max Tokens: ${this.maxTokens}`);
      console.error(`  Temperature: ${this.temperature}`);
      console.error(`  API Key: ${this.apiKey.substring(0, 10)}...${this.apiKey.substring(this.apiKey.length - 4)}`);
      console.error(`  Choices: ${choices || 1}`);
      console.error(`  Detailed: ${detailed || false}`);
    }

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

      if (isDebug) {
        console.error('\n[ZAI Debug] Response received successfully');
        console.error(`  Choices returned: ${response.choices.length}`);
        console.error(`  Model used: ${response.model}`);
        if (response.usage) {
          console.error(`  Token Usage:`);
          console.error(`    Prompt tokens: ${response.usage.prompt_tokens}`);
          console.error(`    Completion tokens: ${response.usage.completion_tokens}`);
          console.error(`    Total tokens: ${response.usage.total_tokens}`);
        }
      }

      const message = response.choices[0]?.message?.content;
      if (!message) {
        throw new Error('ZAI returned empty response');
      }

      // Handle detailed commits or multiple choices
      if (detailed || (choices && choices > 1)) {
        return message.trim();
      }

      return this.postProcessMessage(message);
    } catch (error) {
      if (isDebug) {
        console.error('\n[ZAI Debug] Error Details:');
        console.error(`  Error type: ${error?.constructor?.name}`);
        console.error(`  Full error:`, error);
      }

      if (error instanceof Error) {
        // Handle specific ZAI/OpenAI errors
        if (error.message.includes('429')) {
          throw new Error(
            `ZAI API error (429): ${error.message}\n` +
            `Provider: ${this.name}, Model: ${this.model}, Base URL: https://api.z.ai/api/paas/v4/\n` +
            `This might indicate: insufficient balance, rate limiting, or wrong API endpoint.\n` +
            `Enable debug mode with: export AIC_DEBUG=true`
          );
        }
        if (error.message.includes('invalid_api_key')) {
          throw new Error(`Invalid ZAI API key. Please check your ZAI_API_KEY environment variable.`);
        }
        if (error.message.includes('model_not_found')) {
          throw new Error(
            `ZAI model '${this.model}' not found. Available models: glm-4.6, glm-4.5-air`
          );
        }
        throw new Error(`ZAI API error: ${error.message}`);
      }
      throw new Error('Unknown ZAI error');
    }
  }

  override validateConfig(): boolean {
    // ZAI API keys don't have a specific format requirement
    return !!(this.apiKey && this.apiKey.trim());
  }
}
