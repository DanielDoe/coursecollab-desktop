import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// GET - Fetch overrides for a quiz or student
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get("quizId")
    const studentId = searchParams.get("studentId")

    if (!quizId && !studentId) {
      return NextResponse.json({ error: "quizId or studentId is required" }, { status: 400 })
    }

    let overrides
    if (quizId && studentId) {
      // Get override for specific quiz and student
      overrides = await sql`
        SELECT 
          ao.*,
          s.full_name as student_name,
          s.student_id as student_code,
          q.title as quiz_title
        FROM attempt_overrides ao
        JOIN students s ON ao.student_id = s.id
        JOIN quizzes q ON ao.quiz_id = q.id
        WHERE ao.quiz_id = ${parseInt(quizId)} 
          AND ao.student_id = ${parseInt(studentId)}
          AND ao.is_active = TRUE
          AND (ao.expires_at IS NULL OR ao.expires_at > NOW())
      `
    } else if (quizId) {
      // Get all overrides for a quiz
      overrides = await sql`
        SELECT 
          ao.*,
          s.full_name as student_name,
          s.student_id as student_code,
          q.title as quiz_title
        FROM attempt_overrides ao
        JOIN students s ON ao.student_id = s.id
        JOIN quizzes q ON ao.quiz_id = q.id
        WHERE ao.quiz_id = ${parseInt(quizId)}
          AND ao.is_active = TRUE
          AND (ao.expires_at IS NULL OR ao.expires_at > NOW())
        ORDER BY ao.granted_at DESC
      `
    } else {
      // Get all overrides for a student
      overrides = await sql`
        SELECT 
          ao.*,
          s.full_name as student_name,
          s.student_id as student_code,
          q.title as quiz_title
        FROM attempt_overrides ao
        JOIN students s ON ao.student_id = s.id
        JOIN quizzes q ON ao.quiz_id = q.id
        WHERE ao.student_id = ${parseInt(studentId)}
          AND ao.is_active = TRUE
          AND (ao.expires_at IS NULL OR ao.expires_at > NOW())
        ORDER BY ao.granted_at DESC
      `
    }

    return NextResponse.json({ overrides })
  } catch (error: any) {
    console.error("Error fetching attempt overrides:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Grant an override
export async function POST(request: NextRequest) {
  try {
    const { quizId, studentId, additionalAttempts = 1, reason, expiresAt, instructorId } = await request.json()

    if (!quizId || !studentId) {
      return NextResponse.json({ error: "quizId and studentId are required" }, { status: 400 })
    }

    if (additionalAttempts < 1) {
      return NextResponse.json({ error: "additionalAttempts must be at least 1" }, { status: 400 })
    }

    // Check if override already exists
    const existing = await sql`
      SELECT id FROM attempt_overrides
      WHERE quiz_id = ${parseInt(quizId)} AND student_id = ${parseInt(studentId)}
    `

    let result
    if (existing.length > 0) {
      // Update existing override
      result = await sql`
        UPDATE attempt_overrides
        SET 
          additional_attempts = ${additionalAttempts},
          reason = ${reason || null},
          expires_at = ${expiresAt ? new Date(expiresAt).toISOString() : null},
          is_active = TRUE,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}
        RETURNING *
      `
    } else {
      // Create new override
      result = await sql`
        INSERT INTO attempt_overrides (
          quiz_id, student_id, additional_attempts, reason, granted_by, expires_at
        )
        VALUES (
          ${parseInt(quizId)},
          ${parseInt(studentId)},
          ${additionalAttempts},
          ${reason || null},
          ${instructorId ? parseInt(instructorId) : null},
          ${expiresAt ? new Date(expiresAt).toISOString() : null}
        )
        RETURNING *
      `
    }

    console.log(`[Attempt Override] Granted ${additionalAttempts} extra attempt(s) to student ${studentId} for quiz ${quizId}`)
    return NextResponse.json({ success: true, override: result[0] })
  } catch (error: any) {
    console.error("Error granting attempt override:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Revoke an override
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get("quizId")
    const studentId = searchParams.get("studentId")
    const overrideId = searchParams.get("overrideId")

    if (!overrideId && (!quizId || !studentId)) {
      return NextResponse.json({ error: "overrideId or (quizId and studentId) is required" }, { status: 400 })
    }

    if (overrideId) {
      await sql`
        UPDATE attempt_overrides
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(overrideId)}
      `
    } else {
      await sql`
        UPDATE attempt_overrides
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE quiz_id = ${parseInt(quizId!)} AND student_id = ${parseInt(studentId!)}
      `
    }

    console.log(`[Attempt Override] Revoked override for ${overrideId ? `override ${overrideId}` : `student ${studentId} quiz ${quizId}`}`)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error revoking attempt override:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

