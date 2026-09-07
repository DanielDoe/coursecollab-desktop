import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"
import { invalidateActiveAcademicTermCache, setActiveAcademicTerm } from "@/lib/active-academic-term"

export const dynamic = "force-dynamic"

export async function PUT(request: NextRequest,
  { params }: { params: Promise<{ id: string }> },) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const termId = Number.parseInt(id, 10)
    const { year, term, start_date, end_date, is_active } = await request.json()

    if (!year || !term) {
      return NextResponse.json({ error: "Year and term are required" }, { status: 400 })
    }

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
      UPDATE academic_terms SET
        year = ${year},
        term = ${term},
        start_date = ${start_date || null},
        end_date = ${end_date || null},
        is_active = ${is_active !== undefined ? is_active : true},
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
    console.error("[admin/academic-terms PUT]", error)
    return NextResponse.json({ error: "Failed to update academic term" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest,
  { params }: { params: Promise<{ id: string }> },) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const termId = Number.parseInt(id, 10)

    const sessions = await sql`
      SELECT COUNT(*)::int AS count FROM sessions WHERE academic_term_id = ${termId}
    `
    if ((sessions[0] as { count: number }).count > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete academic term with existing sessions. Delete or reassign sessions first.",
        },
        { status: 400 },
      )
    }

    await sql`DELETE FROM academic_terms WHERE id = ${termId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/academic-terms DELETE]", error)
    return NextResponse.json({ error: "Failed to delete academic term" }, { status: 500 })
  }
}
