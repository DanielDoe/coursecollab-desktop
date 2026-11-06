import { NextRequest, NextResponse } from "next/server"
import { exportGroupsToPDF, type GroupData } from "@/lib/pdf-export"
import { requireFacultyTenantAccess } from "@/lib/tenant/authorize"
import { requireInstructorOrAdminSession } from "@/lib/instructor-session-auth"
import { requirePlatformPrivilegedAcademicAccess } from "@/lib/security/privileged-academic"
import { SECURITY_AUDIT_ACTIONS } from "@/lib/security/actions"
import { recordSecurityAuditEvent, requestAuditMeta } from "@/lib/security/audit"
import { createInstitutionSql } from "@/lib/db-tenant-context"
import { sqlForVerifiedInstitution } from "@/lib/tenant/course-content-sql"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session = searchParams.get("session")
    const status = searchParams.get("status")
    const format = searchParams.get("format") || "pdf"

    const faculty = await requireFacultyTenantAccess(request)
    let tenantDb
    let courseId: number | null = null
    let exportInstitutionId: number | null = null
    if (faculty.ok) {
      tenantDb = await sqlForVerifiedInstitution(faculty.context.institutionId)
      courseId = faculty.context.courseId ?? null
      exportInstitutionId = faculty.context.institutionId
    } else {
      const admin = await requireInstructorOrAdminSession(request)
      if (!admin.ok || admin.actorKind !== "admin") return faculty.response
      const claimedInstitution = Number(searchParams.get("institutionId"))
      const privileged = await requirePlatformPrivilegedAcademicAccess(request, {
        operation: "platform_group_export",
        institutionId: Number.isInteger(claimedInstitution) && claimedInstitution > 0 ? claimedInstitution : null,
        resourceType: "group_export",
        action: SECURITY_AUDIT_ACTIONS.FILE_EXPORT,
      })
      if (!privileged.ok) return privileged.response
      if (privileged.context.institutionId == null) {
        return NextResponse.json({ error: "institutionId is required for platform export" }, { status: 400 })
      }
      exportInstitutionId = privileged.context.institutionId
      tenantDb = createInstitutionSql(exportInstitutionId)
    }

    const sectionFilter = session && session !== "all" ? session : null
    const statusFilter = status && status !== "all" ? status : null

    const groups = await tenantDb`
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
        AND (${courseId}::int IS NULL OR g.course_id = ${courseId})
        AND (${sectionFilter}::text IS NULL OR g.session = ${sectionFilter})
        AND (${statusFilter}::text IS NULL OR g.status = ${statusFilter})
      GROUP BY g.id, g.name, g.session, g.created_by, g.created_at, g.status, s.id, s.full_name, s.student_id, s.section, s.email
      ORDER BY g.session, g.name
    `

    const groupsData: GroupData[] = groups.map((g: {
      id: number
      name: string
      session: string
      status: string
      leader: GroupData["leader"]
      members: GroupData["members"]
      created_at: string
    }) => ({
      id: g.id,
      name: g.name,
      session: g.session,
      status: g.status,
      leader: g.leader,
      members: Array.isArray(g.members) ? g.members : [],
      created_at: g.created_at,
    }))

    await recordSecurityAuditEvent({
      actorType: faculty.ok ? "faculty" : "platform_admin",
      actorId: faculty.ok ? faculty.context.actorId : null,
      institutionId: exportInstitutionId,
      action: SECURITY_AUDIT_ACTIONS.FILE_EXPORT,
      resourceType: "group_export",
      resourceId: courseId,
      result: "success",
      eventScope: exportInstitutionId != null ? "institution" : "platform",
      failClosed: !faculty.ok,
      ...requestAuditMeta(request),
      metadata: { studentLevel: true, format, courseId, count: groupsData.length },
    })

    if (format === "pdf") {
      const pdf = exportGroupsToPDF(groupsData, {
        title: "Groups Report",
        subtitle: session ? `Session: ${session}` : "All Sessions",
        primaryColor: [76, 29, 149],
        includeTimestamp: true,
        includePageNumbers: true,
      })
      const pdfBlob = pdf.output("blob")
      const arrayBuffer = await pdfBlob.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="groups-report-${session || "all"}-${Date.now()}.pdf"`,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      })
    }

    return NextResponse.json({
      groups: groupsData,
      count: groupsData.length,
      exportedAt: new Date().toISOString(),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export groups"
    return NextResponse.json({ error: "Failed to export groups", details: message }, { status: 500 })
  }
}
