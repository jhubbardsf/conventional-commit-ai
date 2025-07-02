import type { AIProvider } from '../../types/index.js';

export abstract class BaseAIProvider implements AIProvider {
  abstract name: string;
  protected apiKey: string;
  protected model: string;
  protected maxTokens: number;
  protected temperature: number;

  constructor(
    apiKey: string,
    model: string,
    maxTokens: number = 150,
    temperature: number = 0.3
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
  }

  abstract generateCommitMessage(
    diff: string,
    description?: string,
    choices?: number
  ): Promise<string>;

  abstract validateConfig(): boolean;

  /**
   * Create a system prompt for generating conventional commit messages
   */
  protected createSystemPrompt(choices?: number): string {
    if (choices && choices > 1) {
      return `You are an expert developer assistant that generates conventional commit messages based on git diffs.

RULES:
1. Generate ${choices} different conventional commit message options following the format: type(scope): description
2. Use these types: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert
3. Keep each first line under 50 characters when possible
4. The description should be concise and descriptive
5. Use lowercase for the description
6. Do not include periods at the end of the first line
7. If multiple types of changes are present, choose the most significant one
8. Make each option distinct and focus on different aspects of the changes

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
1. [first commit message]
2. [second commit message]
3. [third commit message]

EXAMPLES:
1. feat(auth): add user authentication system
2. feat(security): implement login and signup flows
3. feat(backend): create user management endpoints

Generate ONLY the numbered list of commit messages, no explanations or additional text.`;
    }

    return `You are an expert developer assistant that generates conventional commit messages based on git diffs.

RULES:
1. Generate a single conventional commit message following the format: type(scope): description
2. Use these types: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert
3. Keep the first line under 50 characters when possible
4. The description should be concise and descriptive
5. Use lowercase for the description
6. Do not include periods at the end of the first line
7. If multiple types of changes are present, choose the most significant one

EXAMPLES:
- feat(auth): add user authentication system
- fix(api): resolve null pointer exception in user service
- docs: update installation instructions
- refactor(components): simplify button component logic
- test(utils): add unit tests for date helpers

Generate ONLY the commit message, no explanations or additional text.`;
  }

  /**
   * Create a user prompt with the diff and optional description
   */
  protected createUserPrompt(diff: string, description?: string): string {
    let prompt =
      'Please generate a conventional commit message for the following changes:\n\n';

    if (description) {
      prompt += `Additional context: ${description}\n\n`;
    }

    prompt += `Git diff:\n${diff}`;

    return prompt;
  }

  /**
   * Post-process the generated commit message
   */
  protected postProcessMessage(message: string): string {
    // Remove any markdown formatting, quotes, or extra text
    let cleaned = message.trim();

    // Remove markdown code blocks
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

    // Remove quotes if the entire message is wrapped in them
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))
    ) {
      cleaned = cleaned.slice(1, -1);
    }

    // Take only the first line if multiple lines are returned
    const firstLine = cleaned.split('\n')[0]?.trim();
    if (!firstLine) {
      throw new Error('AI provider returned empty commit message');
    }

    // Ensure it doesn't end with a period
    return firstLine.endsWith('.') ? firstLine.slice(0, -1) : firstLine;
  }

  /**
   * Parse multiple commit message choices from AI response
   */
  protected parseMultipleChoices(response: string): string[] {
    const lines = response.trim().split('\n');
    const choices: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      // Match numbered list format: "1. commit message" or "1) commit message"
      const match = trimmedLine.match(/^\d+[.)]\s*(.+)$/);
      if (match && match[1]) {
        const message = match[1].trim();
        // Clean up the message (remove periods, etc.)
        const cleanedMessage = message.endsWith('.')
          ? message.slice(0, -1)
          : message;
        choices.push(cleanedMessage);
      }
    }

    if (choices.length === 0) {
      // Fallback: if parsing fails, use the original post-processing
      return [this.postProcessMessage(response)];
    }

    return choices;
  }
}
