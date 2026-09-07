import { NextResponse } from "next/server"
import { sql } from "@/lib/db"



// GET - Fetch all question time settings
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET() {
  try {
    console.log("[v0] Fetching question time settings for instructor...")

    const settings = await sql`
      SELECT 
        id,
        question_type,
        assessment_type,
        time_limit,
        description,
        updated_at
      FROM question_time_settings
      ORDER BY assessment_type, question_type
    `

    console.log(`[v0] Successfully fetched ${settings.length} time settings`)
    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error("[v0] Failed to fetch question time settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch question time settings" },
      { status: 500 }
    )
  }
}

// POST - Create new question time setting
export async function POST(request: Request) {
  try {
    const {
      question_type,
      assessment_type,
      time_limit,
      description
    } = await request.json()

    console.log(`[v0] Instructor creating time setting for ${question_type} in ${assessment_type}`)

    if (!question_type || !assessment_type || time_limit === undefined) {
      return NextResponse.json(
        { error: "Question type, assessment type, and time limit are required" },
        { status: 400 }
      )
    }

    const result = await sql`
      INSERT INTO question_time_settings (
        question_type,
        assessment_type,
        time_limit,
        description,
        updated_at
      )
      VALUES (
        ${question_type},
        ${assessment_type || 'generic'},
        ${time_limit},
        ${description || null},
        NOW()
      )
      RETURNING *
    `

    console.log(`[v0] Successfully created time setting (ID: ${result[0].id})`)
    return NextResponse.json({
      success: true,
      setting: result[0]
    })
  } catch (error: any) {
    console.error("[v0] Failed to create question time setting:", error)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: "Time setting already exists for this question type and assessment type" },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create question time setting" },
      { status: 500 }
    )
  }
}

// PUT - Update existing question time setting
export async function PUT(request: Request) {
  try {
    const {
      id,
      time_limit,
      description
    } = await request.json()

    console.log(`[v0] Instructor updating time setting ID: ${id}`)

    if (!id || time_limit === undefined) {
      return NextResponse.json(
        { error: "Setting ID and time limit are required" },
        { status: 400 }
      )
    }

    const result = await sql`
      UPDATE question_time_settings
      SET 
        time_limit = ${time_limit},
        description = ${description || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Time setting not found" },
        { status: 404 }
      )
    }

    console.log(`[v0] Successfully updated time setting (ID: ${id})`)
    return NextResponse.json({
      success: true,
      setting: result[0]
    })
  } catch (error: any) {
    console.error("[v0] Failed to update question time setting:", error)
    return NextResponse.json(
      { error: "Failed to update question time setting" },
      { status: 500 }
    )
  }
}

// DELETE - Remove question time setting
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: "Setting ID is required" },
        { status: 400 }
      )
    }

    console.log(`[v0] Instructor deleting time setting ID: ${id}`)

    const result = await sql`
      DELETE FROM question_time_settings
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Time setting not found" },
        { status: 404 }
      )
    }

    console.log(`[v0] Successfully deleted time setting (ID: ${id})`)
    return NextResponse.json({
      success: true,
      message: "Time setting deleted successfully"
    })
  } catch (error: any) {
    console.error("[v0] Failed to delete question time setting:", error)
    return NextResponse.json(
      { error: "Failed to delete question time setting" },
      { status: 500 }
    )
  }
}
