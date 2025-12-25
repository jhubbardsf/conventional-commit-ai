/**
 * Creates the system prompt for PR description generation
 */
export function createPRSystemPrompt(
  template: string,
  branchName: string
): string {
  return `You are an expert developer assistant that generates detailed, well-structured pull request descriptions.

Your task is to analyze code changes and generate a comprehensive PR description that follows the provided template format.

BRANCH: ${branchName}

TEMPLATE TO FOLLOW:
${template}

RULES:
1. Fill in all sections of the template based on the code changes
2. Be specific and technical - mention actual file names, functions, and components changed
3. For the Summary section, write 1-2 sentences describing the overall purpose
4. For the Changes section, use bullet points listing specific modifications
5. For the Testing section, suggest appropriate testing approaches based on the changes
6. Keep HTML comments (<!-- -->) as placeholders only if you cannot determine the content
7. Remove any template instructions/placeholders that you fill in
8. Use markdown formatting appropriately
9. Be concise but thorough - PRs should be scannable but complete
10. If the template has checkboxes, leave them as unchecked (- [ ]) for the author to verify

OUTPUT FORMAT:
- Output ONLY the filled-in PR description
- Do NOT include any preamble like "Here's the PR description:"
- Start directly with the first section heading
`;
}

/**
 * Creates the user prompt containing the diff and optional context
 */
export function createPRUserPrompt(
  diff: string,
  description?: string
): string {
  let prompt = 'Please generate a PR description for the following changes:\n\n';

  if (description) {
    prompt += `ADDITIONAL CONTEXT FROM AUTHOR:\n${description}\n\n`;
  }

  prompt += `GIT DIFF:\n\`\`\`diff\n${diff}\n\`\`\``;

  return prompt;
}

/**
 * Post-processes the PR description to clean up any artifacts
 */
export function postProcessPRDescription(response: string): string {
  let cleaned = response.trim();

  // Remove any leading markdown code block markers if present
  if (cleaned.startsWith('```markdown')) {
    cleaned = cleaned.slice('```markdown'.length);
  } else if (cleaned.startsWith('```md')) {
    cleaned = cleaned.slice('```md'.length);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  // Remove trailing code block marker
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  // Remove common AI preambles
  const preambles = [
    /^Here(?:'s| is) (?:the |a )?(?:PR |pull request )?description[:\s]*/i,
    /^Based on (?:the )?(?:code )?changes[,\s]*/i,
    /^I've (?:generated|created|prepared)[:\s]*/i,
  ];

  for (const preamble of preambles) {
    cleaned = cleaned.replace(preamble, '');
  }

  return cleaned.trim();
}
