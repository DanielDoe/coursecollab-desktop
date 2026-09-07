import { NextRequest, NextResponse } from "next/server"
import { jsonWithPerf, withApiPerf } from "@/lib/perf/api"
import { sql } from "@/lib/db"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import {
  facultyAnnouncementsWhereClause,
  resolveStudentAnnouncementsScope,
  studentAnnouncementsWhereClause,
} from "@/lib/student-announcements-scope"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { resolveInstructorSessionCodeForScope } from "@/lib/instructor-session-scope"
import {
  instructorIdsDisagree,
  studentIdParamFromRequest,
} from "@/lib/announcement-request-auth"
import {
  isInvalidPersistedAttachmentUrl,
  parseAnnouncementAttachments,
  sanitizeAnnouncementAttachments,
} from "@/lib/announcement-attachments"
import { ensureAnnouncementStudentContentLockedColumn } from "@/lib/ensure-announcement-student-content-locked"
import { ensureAnnouncementAiSummaryColumn } from "@/lib/ensure-announcement-ai-summary"
import { generateAndSaveAnnouncementAiSummary, backfillAnnouncementAiSummaries } from "@/lib/announcement-ai-summary"
import {
  ANNOUNCEMENT_STUDENT_LOCKED_MESSAGE,
  redactAnnouncementForStudent,
} from "@/lib/announcement-student-lock"

function validateAttachments(attachments: unknown): string | null {
  if (!Array.isArray(attachments)) return null
  for (const att of attachments) {
    const url = typeof att?.url === "string" ? att.url : ""
    if (isInvalidPersistedAttachmentUrl(url)) {
      const name = typeof att?.name === "string" ? att.name : "Attachment"
      return `"${name}" must be uploaded to the server before publishing. Remove it and add the file again.`
    }
  }
  return null
}

/**
 * GET /api/announcements
 * Fetch all announcements (students see all, instructors see their own)
 */
async function getAnnouncements(request: NextRequest) {
  try {
    await Promise.all([
      ensureAnnouncementStudentContentLockedColumn(),
      ensureAnnouncementAiSummaryColumn(),
    ])
    const { after } = await import("next/server")
    after(() =>
      backfillAnnouncementAiSummaries(8).catch((backfillError) => {
        console.warn("[Announcements] ai_summary backfill:", backfillError)
      }),
    )
    const studentId = studentIdParamFromRequest(request)

    if (instructorIdsDisagree(request)) {
      return NextResponse.json(
        { error: "instructorId query must match x-instructor-id" },
        { status: 400 },
      )
    }

    if (studentId) {
      const auth = await requireBoundStudentCaller(request, studentId)
      if (!auth.ok) return auth.response
      const studentDbId = auth.studentDbId

      const scope = await resolveStudentAnnouncementsScope(studentDbId)
      if (!scope) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }

      const visibilityFilter = await studentAnnouncementsWhereClause(scope)

      // Student view: course- and section-scoped announcements with view/reaction status
      const announcements = await sql`
        SELECT 
          a.*,
          i.name as author_name,
          i.email as author_email,
          COALESCE(vc.cnt, 0) as views_count,
          COALESCE(rc.cnt, 0) as reactions_count,
          COALESCE(cc.cnt, 0) as comments_count,
          (av.announcement_id IS NOT NULL) as viewed_by_me,
          ar.reaction_type as my_reaction
        FROM announcements a
        LEFT JOIN instructors i ON a.author_id = i.id
        LEFT JOIN (
          SELECT announcement_id, COUNT(*)::int AS cnt
          FROM announcement_views
          GROUP BY announcement_id
        ) vc ON vc.announcement_id = a.id
        LEFT JOIN (
          SELECT announcement_id, COUNT(*)::int AS cnt
          FROM announcement_reactions
          GROUP BY announcement_id
        ) rc ON rc.announcement_id = a.id
        LEFT JOIN (
          SELECT announcement_id, COUNT(*)::int AS cnt
          FROM announcement_comments
          GROUP BY announcement_id
        ) cc ON cc.announcement_id = a.id
        LEFT JOIN announcement_views av
          ON av.announcement_id = a.id AND av.student_id = ${studentDbId}
        LEFT JOIN announcement_reactions ar
          ON ar.announcement_id = a.id AND ar.student_id = ${studentDbId}
        WHERE ${visibilityFilter}
        ORDER BY a.pinned DESC NULLS LAST, a.created_at DESC
      `

      // Get reaction breakdown for each announcement
      const reactionsBreakdown = await sql`
        SELECT 
          announcement_id,
          reaction_type,
          COUNT(*) as count
        FROM announcement_reactions
        GROUP BY announcement_id, reaction_type
      `

      // Attach reactions breakdown to each announcement (redact locked content for students)
      const announcementsWithReactions = announcements.map((announcement) => {
        const parsed = {
          ...announcement,
          attachments: parseAnnouncementAttachments(announcement.attachments),
          reactions_breakdown: reactionsBreakdown
            .filter(r => r.announcement_id === announcement.id)
            .reduce((acc, r) => {
              acc[r.reaction_type] = Number(r.count)
              return acc
            }, {} as Record<string, number>)
        }
        return redactAnnouncementForStudent(parsed)
      })

      return jsonWithPerf({ announcements: announcementsWithReactions })
    }

    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const courseId = scope.course.id
    const sessionCode = await resolveInstructorSessionCodeForScope(request)
    const visibilityFilter = await facultyAnnouncementsWhereClause(courseId, sessionCode)

    const announcements = await sql`
      SELECT 
        a.*,
        i.name as author_name,
        COALESCE(vc.cnt, 0) as views_count,
        COALESCE(rc.cnt, 0) as reactions_count,
        COALESCE(cc.cnt, 0) as comments_count
      FROM announcements a
      LEFT JOIN (
        SELECT announcement_id, COUNT(*)::int AS cnt FROM announcement_views GROUP BY announcement_id
      ) vc ON vc.announcement_id = a.id
      LEFT JOIN (
        SELECT announcement_id, COUNT(*)::int AS cnt FROM announcement_reactions GROUP BY announcement_id
      ) rc ON rc.announcement_id = a.id
      LEFT JOIN (
        SELECT announcement_id, COUNT(*)::int AS cnt FROM announcement_comments GROUP BY announcement_id
      ) cc ON cc.announcement_id = a.id
      LEFT JOIN instructors i ON a.author_id = i.id
      WHERE ${visibilityFilter}
      ORDER BY a.pinned DESC NULLS LAST, a.created_at DESC
    `

    const announcementIds = announcements.map((a) => a.id)
    let reactionsBreakdown: { announcement_id: number; reaction_type: string; count: string }[] = []
    if (announcementIds.length > 0) {
      reactionsBreakdown = await sql`
        SELECT announcement_id, reaction_type, COUNT(*) as count
        FROM announcement_reactions
        WHERE announcement_id = ANY(${announcementIds})
        GROUP BY announcement_id, reaction_type
      `
    }

    const announcementsWithReactions = announcements.map((announcement) => ({
      ...announcement,
      attachments: parseAnnouncementAttachments(announcement.attachments),
      reactions_breakdown: reactionsBreakdown
        .filter((r) => r.announcement_id === announcement.id)
        .reduce(
          (acc, r) => {
            acc[r.reaction_type] = Number(r.count)
            return acc
          },
          {} as Record<string, number>,
        ),
    }))

    return jsonWithPerf({ announcements: announcementsWithReactions })
  } catch (error) {
    console.error("[Announcements] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch announcements" }, { status: 500 })
  }
}

export const GET = withApiPerf(getAnnouncements)

/**
 * POST /api/announcements
 * Create a new announcement (instructor only)
 */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const {
      title,
      content,
      pinned = false,
      allow_reactions = true,
      allow_comments = true,
      attachments = [],
      student_content_locked = false,
      type,
      priority,
      target_session,
      expires_at,
      event_date,
      event_time,
      event_end,
      event_location,
    } = body

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 })
    }

    const { after } = await import("next/server")
    const { createCourseAnnouncement, runAnnouncementCreateSideEffects } = await import(
      "@/lib/cora/services/create-announcement"
    )
    const { announcement } = await createCourseAnnouncement({
      instructorId: scope.instructorId,
      courseId: scope.course.id,
      title: String(title),
      content: String(content),
      pinned: pinned === true,
      allowReactions: allow_reactions !== false,
      allowComments: allow_comments !== false,
      attachments,
      studentContentLocked: student_content_locked === true,
      type,
      priority,
      targetSession: target_session,
      expiresAt: expires_at ?? null,
      eventDate: event_date ?? null,
      eventTime: event_time ?? null,
      eventEnd: event_end ?? null,
      eventLocation: event_location ?? null,
    })
    after(() =>
      runAnnouncementCreateSideEffects({
        announcement,
        title: String(title),
        content: String(content),
        lockedForStudents: student_content_locked === true,
        courseId: scope.course.id,
      }).catch((err) => console.error("[Announcements] side effects:", err)),
    )

    return NextResponse.json(
      {
        announcement,
        message: "Announcement created successfully",
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[Announcements] POST error:", error)
    const message = error instanceof Error ? error.message : "Failed to create announcement"
    const status = message.includes("cannot publish")
      ? 403
      : message.includes("required")
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}

