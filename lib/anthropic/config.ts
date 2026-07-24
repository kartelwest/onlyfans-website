import "server-only";

// Change this to switch which Claude model the admin chat assistant and the
// PDF/image importer use. See https://docs.anthropic.com/en/docs/about-claude/models
// for current model IDs.
export const CLAUDE_MODEL = "claude-sonnet-5";

export function getAnthropicApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  return apiKey;
}
