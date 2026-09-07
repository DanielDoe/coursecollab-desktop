import { resolveModelForFeature } from "@/lib/resolve-feature-ai-model"
import { type NextRequest, NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { chatCompletionWithFallback } from "@/lib/openai-with-fallback"
import { evaluateCode } from "@/lib/ai-evaluate-code"
import {
  anthropicKeyPreview,
  getAiProvider,
  isAnthropicApiKeyConfigured,
  isOpenAiApiKeyConfigured,
} from "@/lib/ai-env"
import { pingAnthropic } from "@/lib/anthropic-chat"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const LOG = "[AI Status]"

/**
 * GET /api/health/ai-status
 *
 * Diagnostic endpoint to verify AI/OpenAI setup in production.
 * Call from: https://course-collab.com/api/health/ai-status
 */
export async function GET(request: NextRequest) {
  const cron = requireCronAuth(request)
  if (!cron.ok) return cron.response
  console.log(`${LOG} GET /api/health/ai-status called`)
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    vercelUrl: process.env.VERCEL_URL || null,
  }

  checks.openai = {
    hasKey: isOpenAiApiKeyConfigured(),
    keyLength: process.env.OPENAI_API_KEY?.length ?? 0,
    keyPrefix: isOpenAiApiKeyConfigured()
      ? `${process.env.OPENAI_API_KEY!.slice(0, 7)}...`
      : "N/A",
  }
  checks.anthropic = {
    provider: getAiProvider(),
    hasKey: isAnthropicApiKeyConfigured(),
    keyPreview: anthropicKeyPreview(),
    defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL || "claude-sonnet-4-6",
    fastModel: process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-4-5",
  }
  console.log(
    `${LOG} OPENAI_API_KEY: hasKey=${checks.openai.hasKey} ANTHROPIC: hasKey=${checks.anthropic.hasKey}`,
  )

  if (!isOpenAiApiKeyConfigured() && !isAnthropicApiKeyConfigured()) {
    console.error(`${LOG} No AI provider API key is set`)
    return NextResponse.json({
      ok: false,
      error: "Configure OPENAI_API_KEY and/or ANTHROPIC_API_KEY",
      checks,
    })
  }

  if (isAnthropicApiKeyConfigured()) {
    try {
      console.log(`${LOG} Testing Anthropic API...`)
      const anthropicTest = await pingAnthropic()
      checks.anthropicTest = anthropicTest
      if (!anthropicTest.ok) {
        return NextResponse.json({
          ok: false,
          error: anthropicTest.error || "Anthropic API test failed",
          checks,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      checks.anthropicTest = { ok: false, error: msg }
      return NextResponse.json({
        ok: false,
        error: `Anthropic test failed: ${msg}`,
        checks,
      })
    }
  }

  if (!isOpenAiApiKeyConfigured()) {
    return NextResponse.json({
      ok: true,
      message: "Anthropic AI setup looks OK (OpenAI not configured)",
      checks,
    })
  }

  // OpenAI API test (when configured)
  try {
    console.log(`${LOG} Testing OpenAI API...`)
    const start = Date.now()
    const model = resolveModelForFeature("code")
    const result = await chatCompletionWithFallback(process.env.OPENAI_API_KEY!, {
      model,
      messages: [{ role: "user", content: "Say OK" }],
      max_tokens: 16,
    })
    const elapsed = Date.now() - start

    checks.openaiTest = {
      ok: Boolean(result.content?.trim()),
      elapsedMs: elapsed,
      model,
      modelUsed: result.modelUsed,
      usedFallback: result.usedFallback,
      preview: result.content?.slice(0, 40),
    }
    console.log(`${LOG} OpenAI test: ok=${checks.openaiTest.ok} elapsed=${elapsed}ms model=${result.modelUsed}`)

    if (!result.content?.trim()) {
      return NextResponse.json({
        ok: false,
        error: "OpenAI API returned empty response",
        checks,
      })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const name = err instanceof Error ? err.name : "Error"
    checks.openaiTest = {
      error: msg,
      errorName: name,
    }
    console.error(`${LOG} OpenAI test threw:`, name, msg)
    return NextResponse.json({
      ok: false,
      error: `OpenAI test failed: ${msg}`,
      checks,
    })
  }

  // 3. Test evaluateCode directly (no HTTP fetch)
  try {
    console.log(`${LOG} Testing evaluateCode...`)
    const start = Date.now()
    const result = await evaluateCode({
      questionType: "code_write",
      questionText: "test",
      studentAnswer: "x",
      correctAnswer: "x",
      maxPoints: 1,
    })
    const elapsed = Date.now() - start

    checks.evaluateCode = {
      ok: true,
      elapsedMs: elapsed,
      score: result.score,
      aiGraded: result.aiGraded,
    }
    console.log(`${LOG} evaluateCode test: ok elapsed=${elapsed}ms`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    checks.evaluateCode = {
      error: msg,
    }
    console.error(`${LOG} evaluateCode threw:`, msg)
  }

  console.log(`${LOG} Returning ok=true`)
  return NextResponse.json({
    ok: true,
    message: "AI setup looks OK",
    checks,
  })
}
