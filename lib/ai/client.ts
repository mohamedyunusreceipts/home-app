import Anthropic from '@anthropic-ai/sdk'

/**
 * Model id used for all text suggestions. Kept in ONE place so it's swappable.
 *
 * NOTE: If the exact current Haiku id differs in this environment, change it
 * here only — no other file references a model id.
 */
export const AI_MODEL = 'claude-haiku-4-5'

/**
 * Lazily construct the Anthropic client.
 *
 * The key is read from `process.env.ANTHROPIC_API_KEY` at call time (not module
 * load) so a missing key never crashes the process at import — the route can
 * catch this and surface a clean `AI_NOT_CONFIGURED` 500 instead.
 *
 * Throws `AiNotConfiguredError` if the key is unset.
 */
export class AiNotConfiguredError extends Error {
  readonly code = 'AI_NOT_CONFIGURED'
  constructor() {
    super('ANTHROPIC_API_KEY is not set')
    this.name = 'AiNotConfiguredError'
  }
}

export function getAiClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new AiNotConfiguredError()
  }
  return new Anthropic({ apiKey })
}
