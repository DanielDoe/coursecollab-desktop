import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAcademicTermInstructor } from "@/lib/academic-term-instructor-auth"
import { invalidateActiveAcademicTermCache, setActiveAcademicTerm } from "@/lib/active-academic-term"

export const dynamic = 'force-dynamic'

// PUT update academic term
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAcademicTermInstructor(request)
    if (!auth.ok) return auth.response

    const { id } = await params
    const termId = Number.parseInt(id)
    const { year, term, start_date, end_date, is_active } = await request.json()

    if (!year || !term) {
      return NextResponse.json({ error: "Year and term are required" }, { status: 400 })
    }

    // Check if another term with same year/term exists
    const existing = await sql`
      SELECT id FROM academic_terms 
      WHERE year = ${year} AND term = ${term} AND id != ${termId}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Academic term already exists" }, { status: 400 })
    }

    if (is_active === true) {
      const activated = await setActiveAcademicTerm(termId)
      if (!activated) {
        return NextResponse.json({ error: "Academic term not found" }, { status: 404 })
      }
      return NextResponse.json({ term: activated })
    }

    const result = await sql`
      UPDATE academic_terms
      SET 
        year = ${year},
        term = ${term},
        start_date = ${start_date || null},
        end_date = ${end_date || null},
        is_active = COALESCE(${is_active !== undefined ? is_active : null}, is_active),
        updated_at = NOW()
      WHERE id = ${termId}
      RETURNING id, year, term, start_date, end_date, is_active, created_at
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Academic term not found" }, { status: 404 })
    }

    invalidateActiveAcademicTermCache()
    return NextResponse.json({ term: result[0] })
  } catch (error) {
    console.error("[v0] Failed to update academic term:", error)
    return NextResponse.json({ error: "Failed to update academic term" }, { status: 500 })
  }
}

// DELETE academic term
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAcademicTermInstructor(request)
    if (!auth.ok) return auth.response

    const { id } = await params
    const termId = Number.parseInt(id)

    const activeRow = await sql`
      SELECT is_active FROM academic_terms WHERE id = ${termId} LIMIT 1
    `
    if (activeRow.length === 0) {
      return NextResponse.json({ error: "Academic term not found" }, { status: 404 })
    }
    if (activeRow[0].is_active === true) {
      return NextResponse.json(
        { error: "Cannot delete the active academic term. Activate another term first." },
        { status: 400 },
      )
    }

    // Check if term has sessions
    const sessions = await sql`
      SELECT COUNT(*) as count FROM sessions WHERE academic_term_id = ${termId}
    `

    if (sessions[0].count > 0) {
      return NextResponse.json(
        { error: "Cannot delete academic term with existing sessions. Please delete or reassign sessions first." },
        { status: 400 }
      )
    }

    await sql`
      DELETE FROM academic_terms WHERE id = ${termId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to delete academic term:", error)
    return NextResponse.json({ error: "Failed to delete academic term" }, { status: 500 })
  }
}



