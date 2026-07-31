import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

/** Lazily constructed so the app can still boot (and degrade gracefully —
 * Part 11.5, 12) if ANTHROPIC_API_KEY is missing; only Coach-dependent
 * routes fail, and they fail with a plain explanation, not a crash. */
export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AnthropicNotConfiguredError();
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
