import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { exportGroupsToPDF, type GroupData } from "@/lib/pdf-export"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"
export const maxDuration = 60

/**
 * GET /api/groups/export
 * 
 * Export groups data to PDF
 * Query params:
 * - session: Filter by session (optional)
 * - status: Filter by status (optional)
 * - format: 'pdf' (default)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session = searchParams.get("session")
    const status = searchParams.get("status")
    const format = searchParams.get("format") || "pdf"

    // Verify authentication
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    const adminId = request.headers.get("x-admin-id")
    
    if (!instructorSession && !adminId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Build query with proper conditional WHERE clauses
    // Use sql.unsafe() pattern like projects export
    const whereConditions: string[] = []
    
    if (session && session !== "all") {
      whereConditions.push(`g.session = '${session.replace(/'/g, "''")}'`)
    }
    
    if (status && status !== "all") {
      whereConditions.push(`g.status = '${status.replace(/'/g, "''")}'`)
    }
    
    // Build the WHERE clause
    const whereClause = whereConditions.length > 0 
      ? ` AND ${whereConditions.join(" AND ")}` 
      : ""
    
    const groups = whereClause
      ? await sql`
          SELECT 
            g.id,
            g.name,
            g.session,
            g.created_by,
            g.created_at,
            g.status,
            json_build_object(
              'id', s.id,
              'full_name', s.full_name,
              'student_id', s.student_id,
              'section', s.section,
              'email', s.email
            ) as leader,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', st.id,
                  'full_name', st.full_name,
                  'student_id', st.student_id,
                  'section', st.section,
                  'email', st.email
                ) ORDER BY st.full_name
              ) FILTER (WHERE st.id IS NOT NULL),
              '[]'::json
            ) as members
          FROM groups g
          JOIN students s ON g.created_by = s.id
          LEFT JOIN group_members gm ON gm.group_id = g.id
          LEFT JOIN students st ON gm.student_id = st.id
          WHERE g.deleted_at IS NULL ${sql.unsafe(whereClause)}
          GROUP BY g.id, g.name, g.session, g.created_by, g.created_at, g.status, s.id, s.full_name, s.student_id, s.section, s.email
          ORDER BY g.session, g.name
        `
      : await sql`
          SELECT 
            g.id,
            g.name,
            g.session,
            g.created_by,
            g.created_at,
            g.status,
            json_build_object(
              'id', s.id,
              'full_name', s.full_name,
              'student_id', s.student_id,
              'section', s.section,
              'email', s.email
            ) as leader,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', st.id,
                  'full_name', st.full_name,
                  'student_id', st.student_id,
                  'section', st.section,
                  'email', st.email
                ) ORDER BY st.full_name
              ) FILTER (WHERE st.id IS NOT NULL),
              '[]'::json
            ) as members
          FROM groups g
          JOIN students s ON g.created_by = s.id
          LEFT JOIN group_members gm ON gm.group_id = g.id
          LEFT JOIN students st ON gm.student_id = st.id
          WHERE g.deleted_at IS NULL
          GROUP BY g.id, g.name, g.session, g.created_by, g.created_at, g.status, s.id, s.full_name, s.student_id, s.section, s.email
          ORDER BY g.session, g.name
        `

    // Transform data
    const groupsData: GroupData[] = groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      session: g.session,
      status: g.status,
      leader: g.leader,
      members: Array.isArray(g.members) ? g.members : [],
      created_at: g.created_at
    }))

    if (format === "pdf") {
      // Generate PDF
      const pdf = exportGroupsToPDF(groupsData, {
        title: "Groups Report",
        subtitle: session ? `Session: ${session}` : "All Sessions",
        primaryColor: [76, 29, 149], // Purple
        includeTimestamp: true,
        includePageNumbers: true
      })

      // Generate PDF as buffer
      const pdfBlob = pdf.output("blob")
      const arrayBuffer = await pdfBlob.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Return PDF
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="groups-report-${session || "all"}-${Date.now()}.pdf"`,
          "Content-Length": buffer.length.toString()
        }
      })
    }

    // JSON format (fallback)
    return NextResponse.json({
      groups: groupsData,
      count: groupsData.length,
      exportedAt: new Date().toISOString()
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to export groups", details: error.message },
      { status: 500 }
    )
  }
}
