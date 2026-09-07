import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

// Mark as dynamic to prevent build-time database initialization
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const configId = searchParams.get("configId")

    if (configId) {
      // Get specific configuration with all related data
      const config = await sql`
        SELECT * FROM ai_evaluation_config WHERE id = ${configId}
      `
      
      if (config.length === 0) {
        return NextResponse.json({ error: "Configuration not found" }, { status: 404 })
      }

      // Get model configuration
      const modelConfig = await sql`
        SELECT * FROM ai_model_config WHERE config_id = ${configId}
      `

      // Get evaluation criteria
      const criteria = await sql`
        SELECT * FROM ai_evaluation_criteria WHERE config_id = ${configId} ORDER BY weight DESC
      `

      // Get question type configurations
      const questionTypeConfigs = await sql`
        SELECT * FROM ai_question_type_config WHERE config_id = ${configId}
      `

      // Get scoring configuration
      const scoringConfig = await sql`
        SELECT * FROM ai_scoring_config WHERE config_id = ${configId}
      `

      return NextResponse.json({
        config: config[0],
        modelConfig: modelConfig[0] || null,
        criteria,
        questionTypeConfigs,
        scoringConfig: scoringConfig[0] || null,
      })
    } else {
      // Get all configurations
      const configs = await sql`
        SELECT * FROM ai_evaluation_config ORDER BY created_at DESC
      `

      return NextResponse.json({ configs })
    }
  } catch (error) {
    console.error("[v0] Failed to fetch AI configuration:", error)
    return NextResponse.json({ error: "Failed to fetch AI configuration" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const body = await request.json()
    const { 
      name, 
      description, 
      modelConfig, 
      criteria, 
      questionTypeConfigs, 
      scoringConfig 
    } = body

    if (!name || !description) {
      return NextResponse.json({ error: "Name and description are required" }, { status: 400 })
    }

    // Start transaction-like operations
    const configResult = await sql`
      INSERT INTO ai_evaluation_config (name, description, is_active)
      VALUES (${name}, ${description}, true)
      RETURNING id
    `
    const configId = configResult[0].id

    // Insert model configuration
    if (modelConfig) {
      await sql`
        INSERT INTO ai_model_config (
          config_id, model_name, temperature, max_tokens, top_p, 
          frequency_penalty, presence_penalty
        )
        VALUES (
          ${configId}, ${modelConfig.model_name}, ${modelConfig.temperature}, 
          ${modelConfig.max_tokens}, ${modelConfig.top_p}, 
          ${modelConfig.frequency_penalty}, ${modelConfig.presence_penalty}
        )
      `
    }

    // Insert evaluation criteria
    if (criteria && Array.isArray(criteria)) {
      for (const criterion of criteria) {
        await sql`
          INSERT INTO ai_evaluation_criteria (
            config_id, criteria_name, weight, description, prompt_template, is_enabled
          )
          VALUES (
            ${configId}, ${criterion.criteria_name}, ${criterion.weight}, 
            ${criterion.description}, ${criterion.prompt_template}, ${criterion.is_enabled}
          )
        `
      }
    }

    // Insert question type configurations
    if (questionTypeConfigs && Array.isArray(questionTypeConfigs)) {
      for (const qtConfig of questionTypeConfigs) {
        await sql`
          INSERT INTO ai_question_type_config (
            config_id, question_type, specific_prompt, evaluation_rubric, 
            partial_credit_enabled, max_attempts
          )
          VALUES (
            ${configId}, ${qtConfig.question_type}, ${qtConfig.specific_prompt}, 
            ${qtConfig.evaluation_rubric}, ${qtConfig.partial_credit_enabled}, 
            ${qtConfig.max_attempts}
          )
        `
      }
    }

    // Insert scoring configuration
    if (scoringConfig) {
      await sql`
        INSERT INTO ai_scoring_config (
          config_id, perfect_score_threshold, good_score_threshold, passing_score_threshold,
          partial_credit_enabled, minimum_partial_score, bonus_points_enabled, max_bonus_points
        )
        VALUES (
          ${configId}, ${scoringConfig.perfect_score_threshold}, ${scoringConfig.good_score_threshold}, 
          ${scoringConfig.passing_score_threshold}, ${scoringConfig.partial_credit_enabled}, 
          ${scoringConfig.minimum_partial_score}, ${scoringConfig.bonus_points_enabled}, 
          ${scoringConfig.max_bonus_points}
        )
      `
    }

    return NextResponse.json({ 
      success: true, 
      configId,
      message: "AI evaluation configuration created successfully" 
    })
  } catch (error) {
    console.error("[v0] Failed to create AI configuration:", error)
    return NextResponse.json({ error: "Failed to create AI configuration" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const body = await request.json()
    const { 
      configId,
      name, 
      description, 
      is_active,
      modelConfig, 
      criteria, 
      questionTypeConfigs, 
      scoringConfig 
    } = body

    if (!configId) {
      return NextResponse.json({ error: "Configuration ID is required" }, { status: 400 })
    }

    // Update main configuration
    await sql`
      UPDATE ai_evaluation_config 
      SET name = ${name}, description = ${description}, is_active = ${is_active}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${configId}
    `

    // Update model configuration
    if (modelConfig) {
      await sql`
        UPDATE ai_model_config 
        SET 
          model_name = ${modelConfig.model_name},
          temperature = ${modelConfig.temperature},
          max_tokens = ${modelConfig.max_tokens},
          top_p = ${modelConfig.top_p},
          frequency_penalty = ${modelConfig.frequency_penalty},
          presence_penalty = ${modelConfig.presence_penalty},
          updated_at = CURRENT_TIMESTAMP
        WHERE config_id = ${configId}
      `
    }

    // Update evaluation criteria (delete and recreate)
    if (criteria && Array.isArray(criteria)) {
      await sql`DELETE FROM ai_evaluation_criteria WHERE config_id = ${configId}`
      
      for (const criterion of criteria) {
        await sql`
          INSERT INTO ai_evaluation_criteria (
            config_id, criteria_name, weight, description, prompt_template, is_enabled
          )
          VALUES (
            ${configId}, ${criterion.criteria_name}, ${criterion.weight}, 
            ${criterion.description}, ${criterion.prompt_template}, ${criterion.is_enabled}
          )
        `
      }
    }

    // Update question type configurations (delete and recreate)
    if (questionTypeConfigs && Array.isArray(questionTypeConfigs)) {
      await sql`DELETE FROM ai_question_type_config WHERE config_id = ${configId}`
      
      for (const qtConfig of questionTypeConfigs) {
        await sql`
          INSERT INTO ai_question_type_config (
            config_id, question_type, specific_prompt, evaluation_rubric, 
            partial_credit_enabled, max_attempts
          )
          VALUES (
            ${configId}, ${qtConfig.question_type}, ${qtConfig.specific_prompt}, 
            ${qtConfig.evaluation_rubric}, ${qtConfig.partial_credit_enabled}, 
            ${qtConfig.max_attempts}
          )
        `
      }
    }

    // Update scoring configuration
    if (scoringConfig) {
      await sql`
        UPDATE ai_scoring_config 
        SET 
          perfect_score_threshold = ${scoringConfig.perfect_score_threshold},
          good_score_threshold = ${scoringConfig.good_score_threshold},
          passing_score_threshold = ${scoringConfig.passing_score_threshold},
          partial_credit_enabled = ${scoringConfig.partial_credit_enabled},
          minimum_partial_score = ${scoringConfig.minimum_partial_score},
          bonus_points_enabled = ${scoringConfig.bonus_points_enabled},
          max_bonus_points = ${scoringConfig.max_bonus_points},
          updated_at = CURRENT_TIMESTAMP
        WHERE config_id = ${configId}
      `
    }

    return NextResponse.json({ 
      success: true, 
      message: "AI evaluation configuration updated successfully" 
    })
  } catch (error) {
    console.error("[v0] Failed to update AI configuration:", error)
    return NextResponse.json({ error: "Failed to update AI configuration" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const configId = searchParams.get("configId")

    if (!configId) {
      return NextResponse.json({ error: "Configuration ID is required" }, { status: 400 })
    }

    // Delete configuration (cascade will handle related records)
    await sql`DELETE FROM ai_evaluation_config WHERE id = ${configId}`

    return NextResponse.json({ 
      success: true, 
      message: "AI evaluation configuration deleted successfully" 
    })
  } catch (error) {
    console.error("[v0] Failed to delete AI configuration:", error)
    return NextResponse.json({ error: "Failed to delete AI configuration" }, { status: 500 })
  }
}
