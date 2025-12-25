import * as fs from 'fs/promises';
import * as path from 'path';

const DEFAULT_PR_TEMPLATE = `## Summary

<!-- Brief description of what this PR does -->

## Changes

<!-- List the key changes made -->

## Testing

<!-- How was this tested? -->

## Checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated as needed
- [ ] Documentation updated as needed
`;

/**
 * Attempts to load the PR template from the repository
 * Checks common template locations
 */
export async function loadPRTemplate(repoRoot: string): Promise<string | null> {
  const templatePaths = [
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/pull_request_template.md',
    'PULL_REQUEST_TEMPLATE.md',
    'pull_request_template.md',
    '.github/PULL_REQUEST_TEMPLATE/default.md',
  ];

  for (const templatePath of templatePaths) {
    const fullPath = path.join(repoRoot, templatePath);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch {
      // Template doesn't exist at this path, continue checking
    }
  }

  return null;
}

/**
 * Returns the default PR template
 */
export function getDefaultPRTemplate(): string {
  return DEFAULT_PR_TEMPLATE;
}

/**
 * Gets the PR template, falling back to default if none exists
 */
export async function getPRTemplate(repoRoot: string): Promise<{
  template: string;
  isCustom: boolean;
}> {
  const customTemplate = await loadPRTemplate(repoRoot);

  if (customTemplate) {
    return {
      template: customTemplate,
      isCustom: true,
    };
  }

  return {
    template: DEFAULT_PR_TEMPLATE,
    isCustom: false,
  };
}
