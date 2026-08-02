import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

/** Lazily constructed so the app can still boot (and degrade gracefully -
 * Part 11.5, 12) if ANTHROPIC_API_KEY is missing; only Coach-dependent
 * routes fail, and they fail with a plain explanation, not a crash. */
export function getAnthropicClient(): Anthropic {
  // Trimmed defensively: a stray trailing newline or space - easy to pick up
  // when pasting a secret into a web form - is otherwise invisible right up
  // until Node's HTTP header validation rejects it outright.
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new AnthropicNotConfiguredError();
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super(
      'The writing assistant is not connected yet. Ask the operator to add an Anthropic API key (see docs/OWNER_SETUP_CHECKLIST.md).'
    );
    this.name = 'AnthropicNotConfiguredError';
  }
}

export const COACH_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
