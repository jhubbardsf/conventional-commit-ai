import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAIProvider } from './base.js';

export class GeminiProvider extends BaseAIProvider {
  name = 'gemini';
  private client: GoogleGenerativeAI;

  constructor(
    apiKey: string,
    model: string = 'gemini-1.5-flash',
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
      console.log(prompt);
      const result = await model.generateContent(prompt);
      console.log(result);
      const response = result.response;

      if (!response) {
        throw new Error('Gemini returned no response');
      }

      // Check for safety ratings that might block content
      const promptFeedback = response.promptFeedback;
      if (promptFeedback?.blockReason) {
        throw new Error(
          `Gemini blocked the request: ${promptFeedback.blockReason}`
        );
      }

      // Check for candidate responses
      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('Gemini returned no candidate responses');
      }

      const candidate = candidates[0];
      if (!candidate) {
        throw new Error('Gemini returned no valid candidate');
      }

      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(
          `Gemini response incomplete: ${candidate.finishReason}`
        );
      }

      const text = response.text();

      if (!text || text.trim() === '') {
        // More detailed error with response info
        const debugInfo = {
          promptFeedback: promptFeedback,
          candidateCount: candidates?.length,
          finishReason: candidate?.finishReason,
          safetyRatings: candidate?.safetyRatings,
        };
        throw new Error(
          `Gemini returned empty response. Debug info: ${JSON.stringify(debugInfo)}`
        );
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
      // Latest Gemini 2.5 models
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-preview-04-17',
      'gemini-2.5-flash-lite-preview-06-17',

      // Gemini 2.0 models
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-thinking-exp',

      // Gemini 1.5 models
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',

      // Deprecated but still listed for compatibility
      'gemini-pro',
      'gemini-pro-latest',
    ];
  }

  /**
   * Validate if the model is supported
   */
  static isModelSupported(model: string): boolean {
    return this.getAvailableModels().includes(model);
  }
}
