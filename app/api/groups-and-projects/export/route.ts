import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { exportGroupsAndProjectsToPDF, type GroupData, type PDFExportOptions, type ProjectData, type ProjectPresentationSlot } from "@/lib/pdf-export"
import { resolvePdfArchiveMeta } from "@/lib/pdf-export-archive-meta"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"
export const maxDuration = 90

/**
 * GET /api/groups-and-projects/export
 * 
 * Export combined groups and projects data to PDF
 * Query params:
 * - session: Filter by session (optional)
 * - format: 'pdf' (default)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session = searchParams.get("session")
    const format = searchParams.get("format") || "pdf"

    // Verify authentication
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    const adminId = request.headers.get("x-admin-id")
    
    if (!instructorSession && !adminId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    console.log("[Combined Export] Fetching groups and projects data:", { session })

    const sessionVariants =
      session && session !== "all" ? normalizedSectionVariantsForSql(session) : []

    // Fetch groups
    let groupsQuery = sql`
      SELECT 
        g.id,
        g.name,
        g.session,
        g.status,
        g.created_at,
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
      LEFT JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN students st ON gm.student_id = st.id
      WHERE g.deleted_at IS NULL
    `

    if (session && session !== "all") {
      groupsQuery = sql`${groupsQuery} AND TRIM(g.session) = ANY(${sessionVariants}::text[])`
    }

    groupsQuery = sql`${groupsQuery} GROUP BY g.id, s.id, s.full_name, s.student_id, s.section, s.email ORDER BY g.created_at DESC`

    const groups = await groupsQuery

    // Fetch projects
    let projectsQuery = sql`
      SELECT 
        p.id,
        p.group_id,
        p.title,
        p.summary,
        p.deliverables,
        p.target_platform,
        p.project_link,
        p.status,
        p.rejection_reason,
        p.timeline,
        p.created_at,
        p.updated_at,
        (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'scheduled_date', pp.scheduled_date,
                'start_time', pp.start_time,
                'end_time', pp.end_time,
                'status', pp.status
              )
              ORDER BY pp.scheduled_date NULLS LAST, pp.start_time NULLS LAST
            ),
            '[]'::json
          )
          FROM project_presentations pp
          WHERE pp.project_id = p.id
            AND COALESCE(pp.status, '') <> 'cancelled'
        ) AS presentations,
        json_build_object(
          'id', g.id,
          'name', g.name,
          'session', g.session,
          'status', g.status
        ) as group,
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
      FROM projects p
      JOIN groups g ON p.group_id = g.id
      JOIN students s ON g.created_by = s.id
      LEFT JOIN group_members gm ON gm.group_id = g.id
      LEFT JOIN students st ON gm.student_id = st.id
      WHERE g.deleted_at IS NULL
    `

    if (session && session !== "all") {
      projectsQuery = sql`${projectsQuery} AND TRIM(g.session) = ANY(${sessionVariants}::text[])`
    }

    projectsQuery = sql`${projectsQuery} GROUP BY p.id, p.group_id, p.title, p.summary, p.deliverables, p.target_platform, p.project_link, p.status, p.rejection_reason, p.timeline, p.created_at, p.updated_at, g.id, g.name, g.session, g.status, s.id, s.full_name, s.student_id, s.section, s.email ORDER BY p.created_at DESC`

    const projects = await projectsQuery

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

    const normalizePresentations = (raw: unknown): ProjectPresentationSlot[] => {
      if (!raw || !Array.isArray(raw)) return []
      return raw as ProjectPresentationSlot[]
    }

    const projectsData: ProjectData[] = projects.map((p: any) => ({
      id: p.id,
      title: p.title,
      project_link: p.project_link,
      summary: p.summary,
      deliverables: p.deliverables,
      target_platform: p.target_platform,
      status: p.status,
      rejection_reason: p.rejection_reason ?? null,
      timeline: p.timeline,
      group: p.group,
      leader: p.leader,
      members: Array.isArray(p.members) ? p.members : [],
      presentations: normalizePresentations(p.presentations),
      created_at: p.created_at,
      updated_at: p.updated_at
    }))

    let presentationWindow: PDFExportOptions["presentationWindow"]
    if (session && session !== "all") {
      try {
        const cfgRows = await sql`
          SELECT presentation_start_date, presentation_end_date
          FROM presentation_config
          WHERE session = ${session}
          LIMIT 1
        `
        if (cfgRows.length > 0) {
          const row = cfgRows[0] as {
            presentation_start_date: unknown
            presentation_end_date: unknown
          }
          presentationWindow = {
            session,
            startDate: String(row.presentation_start_date ?? ""),
            endDate: String(row.presentation_end_date ?? ""),
          }
        }
      } catch {
        /* optional table */
      }
    }

    console.log("[Combined Export] Found", groupsData.length, "groups and", projectsData.length, "projects")

    if (format === "pdf") {
      const archiveMeta = await resolvePdfArchiveMeta(request, session, "groups-projects")

      // Generate PDF
      const pdf = exportGroupsAndProjectsToPDF(groupsData, projectsData, {
        title: "Groups & Projects Report",
        subtitle: session && session !== "all" ? `Session filter: ${session}` : "All sessions",
        coverLines: archiveMeta.coverLines,
        primaryColor: [76, 29, 149], // Purple
        includeTimestamp: true,
        includePageNumbers: true,
        presentationWindow,
      })

      // Generate PDF as buffer
      const pdfBlob = pdf.output("blob")
      const arrayBuffer = await pdfBlob.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const safeName = `${archiveMeta.filenameStem}.pdf`.replace(/[^\w.\-()+]+/g, "-")

      // Return PDF
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Content-Length": buffer.length.toString()
        }
      })
    }

    // JSON format (fallback)
    return NextResponse.json({
      groups: groupsData,
      projects: projectsData,
      groupsCount: groupsData.length,
      projectsCount: projectsData.length,
      exportedAt: new Date().toISOString()
    })

  } catch (error: any) {
    console.error("[Combined Export] Error:", error)
    return NextResponse.json(
      { error: "Failed to export groups and projects", details: error.message },
      { status: 500 }
    )
  }
}

