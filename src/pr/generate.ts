import type { AIProvider } from '../types/index.js';
import { createPRSystemPrompt, createPRUserPrompt, postProcessPRDescription } from './prompt.js';

/**
 * Generates a PR description using the AI provider
 */
export async function generatePRDescription(
  provider: AIProvider,
  diff: string,
  template: string,
  branchName: string,
  description?: string
): Promise<string> {
  const systemPrompt = createPRSystemPrompt(template, branchName);
  const userPrompt = createPRUserPrompt(diff, description);

  // Use the provider's generic generate method with our PR-specific prompts
  const response = await provider.generate(systemPrompt, userPrompt);

  return postProcessPRDescription(response);
}
