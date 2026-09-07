import { resolveModelForFeature } from "@/lib/resolve-feature-ai-model"
import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



// GET - Fetch current AI settings
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET() {
  try {
    const settings = await sql`
      SELECT * FROM ai_settings ORDER BY id DESC LIMIT 1
    `

    if (settings.length === 0) {
      return NextResponse.json({
        model: resolveModelForFeature("tutor"),
        temperature: 0.0,
        max_tokens: 200,
        timeout_seconds: 20,
        confidence_high: 0.9,
        confidence_medium: 0.5,
        enable_cost_tracking: true,
        auto_approve_high_confidence: true,
      })
    }

    return NextResponse.json(settings[0])
  } catch (error) {
    console.error("[v0] ❌ Failed to fetch AI settings:", error)
    return NextResponse.json({ error: "Failed to fetch AI settings" }, { status: 500 })
  }
}

// POST - Update AI settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      model,
      temperature,
      max_tokens,
      timeout_seconds,
      confidence_high,
      confidence_medium,
      enable_cost_tracking,
      auto_approve_high_confidence,
      updated_by,
    } = body

    await sql`
      INSERT INTO ai_settings (
        model, temperature, max_tokens, timeout_seconds,
        confidence_high, confidence_medium, enable_cost_tracking,
        auto_approve_high_confidence, updated_by, updated_at
      )
      VALUES (
        ${model}, ${temperature}, ${max_tokens}, ${timeout_seconds},
        ${confidence_high}, ${confidence_medium}, ${enable_cost_tracking},
        ${auto_approve_high_confidence}, ${updated_by}, NOW()
      )
    `

    // Log the settings change
    await sql`
      INSERT INTO ai_audit_log (action, user_name, details)
      VALUES ('Settings Updated', ${updated_by}, ${JSON.stringify(body)})
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] ❌ Failed to update AI settings:", error)
    return NextResponse.json({ error: "Failed to update AI settings" }, { status: 500 })
  }
}
