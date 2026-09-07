import { NextResponse } from "next/server"
import { sql } from "@/lib/db"



// GET - Fetch all question type weights
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET() {
  try {
    console.log("[v0] Fetching question type weights for instructor...")

    const weights = await sql`
      SELECT 
        id,
        question_type,
        assessment_type,
        points_value,
        percentage_weight,
        evaluation_mode,
        grading_mode,
        updated_at
      FROM question_type_weights
      ORDER BY assessment_type, question_type
    `

    console.log(`[v0] Successfully fetched ${weights.length} weight configurations`)
    return NextResponse.json({ weights })
  } catch (error: any) {
    console.error("[v0] Failed to fetch question type weights:", error)
    return NextResponse.json(
      { error: "Failed to fetch question type weights" },
      { status: 500 }
    )
  }
}

// POST - Create new question type weight configuration
export async function POST(request: Request) {
  try {
    const {
      question_type,
      assessment_type,
      points_value,
      percentage_weight,
      evaluation_mode,
      grading_mode
    } = await request.json()

    console.log(`[v0] Instructor creating weight config for ${question_type} in ${assessment_type}`)

    if (!question_type || !assessment_type) {
      return NextResponse.json(
        { error: "Question type and assessment type are required" },
        { status: 400 }
      )
    }

    const result = await sql`
      INSERT INTO question_type_weights (
        question_type,
        assessment_type,
        points_value,
        percentage_weight,
        evaluation_mode,
        grading_mode,
        updated_at
      )
      VALUES (
        ${question_type},
        ${assessment_type || 'generic'},
        ${points_value || 1.0},
        ${percentage_weight || 0.0},
        ${evaluation_mode || 'auto'},
        ${grading_mode || 'graded'},
        NOW()
      )
      RETURNING *
    `

    console.log(`[v0] Successfully created weight configuration (ID: ${result[0].id})`)
    return NextResponse.json({
      success: true,
      weight: result[0]
    })
  } catch (error: any) {
    console.error("[v0] Failed to create question type weight:", error)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: "Weight configuration already exists for this question type and assessment type" },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create question type weight" },
      { status: 500 }
    )
  }
}

// PUT - Update existing question type weight configuration
export async function PUT(request: Request) {
  try {
    const {
      id,
      question_type,
      assessment_type,
      points_value,
      percentage_weight,
      evaluation_mode,
      grading_mode
    } = await request.json()

    console.log(`[v0] Instructor updating weight config ID: ${id}`)

    if (!id) {
      return NextResponse.json(
        { error: "Weight configuration ID is required" },
        { status: 400 }
      )
    }

    const result = await sql`
      UPDATE question_type_weights
      SET 
        points_value = ${points_value},
        percentage_weight = ${percentage_weight},
        evaluation_mode = ${evaluation_mode},
        grading_mode = ${grading_mode},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Weight configuration not found" },
        { status: 404 }
      )
    }

    console.log(`[v0] Successfully updated weight configuration (ID: ${id})`)
    return NextResponse.json({
      success: true,
      weight: result[0]
    })
  } catch (error: any) {
    console.error("[v0] Failed to update question type weight:", error)
    return NextResponse.json(
      { error: "Failed to update question type weight" },
      { status: 500 }
    )
  }
}

// DELETE - Remove question type weight configuration
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: "Weight configuration ID is required" },
        { status: 400 }
      )
    }

    console.log(`[v0] Instructor deleting weight config ID: ${id}`)

    const result = await sql`
      DELETE FROM question_type_weights
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Weight configuration not found" },
        { status: 404 }
      )
    }

    console.log(`[v0] Successfully deleted weight configuration (ID: ${id})`)
    return NextResponse.json({
      success: true,
      message: "Weight configuration deleted successfully"
    })
  } catch (error: any) {
    console.error("[v0] Failed to delete question type weight:", error)
    return NextResponse.json(
      { error: "Failed to delete question type weight" },
      { status: 500 }
    )
  }
}
