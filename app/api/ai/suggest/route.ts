import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AI_MODEL, AiNotConfiguredError, getAiClient } from '@/lib/ai/client'
import { checkAndIncrement } from '@/lib/ai/usage'
import { buildPrompt, isPromptKind } from '@/lib/ai/prompts'

/**
 * POST /api/ai/suggest — single AI-suggest endpoint (spec §8.1).
 *
 * Body: { kind: string, context: unknown }
 *
 * Flow:
 *   1. Auth-gate via the server Supabase client (reject anonymous / household-less).
 *   2. Validate `kind` against the prompt registry (400 on unknown kind).
 *   3. Enforce the per-household soft monthly cap; 429 when reached (no increment).
 *   4. Build the per-kind prompt and call Claude (model id lives in lib/ai/client).
 *   5. Return { result } — the assistant's text.
 *
 * `ANTHROPIC_API_KEY` is read at request time inside getAiClient(); if unset we
 * surface a clean 500 { code: 'AI_NOT_CONFIGURED' } rather than crashing.
 */

export const runtime = 'nodejs'

const MAX_TOKENS = 1024

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // 1. Auth gate.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .limit(1)
    .maybeSingle<{ household_id: string }>()
  if (!membership) {
    return NextResponse.json({ error: 'No household' }, { status: 403 })
  }
  const householdId = membership.household_id

  // 2. Parse + validate the body.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { kind, context } =
    body && typeof body === 'object'
      ? (body as { kind?: unknown; context?: unknown })
      : {}

  if (!isPromptKind(kind)) {
    return NextResponse.json({ error: 'Unknown kind' }, { status: 400 })
  }

  // 3. Enforce the per-household monthly cap (no increment when over).
  const usage = await checkAndIncrement(supabase, householdId)
  if (!usage.allowed) {
    return NextResponse.json(
      { error: `Monthly AI limit reached (${usage.used}/${usage.cap})` },
      { status: 429 },
    )
  }

  // 4. Build the prompt and call Claude.
  const { system, messages } = buildPrompt(kind, context)

  let client
  try {
    client = getAiClient()
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ code: 'AI_NOT_CONFIGURED' }, { status: 500 })
    }
    throw err
  }

  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
    })
    // Concatenate text blocks; ignore non-text (e.g. tool_use) blocks.
    const result = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
    return NextResponse.json({ result })
  } catch {
    return NextResponse.json(
      { error: 'AI request failed', code: 'AI_REQUEST_FAILED' },
      { status: 502 },
    )
  }
}
