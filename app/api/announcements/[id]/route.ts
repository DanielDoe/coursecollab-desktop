import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import {
  resolveStudentAnnouncementsScope,
  studentAnnouncementsWhereClause,
} from "@/lib/student-announcements-scope"
import { isInvalidPersistedAttachmentUrl, parseAnnouncementAttachments, sanitizeAnnouncementAttachments } from "@/lib/announcement-attachments"
import {
  instructorCanAccessAnnouncement,
  instructorIdFromRequest,
  instructorIdsDisagree,
  studentIdParamFromRequest,
} from "@/lib/announcement-request-auth"
import { ensureAnnouncementStudentContentLockedColumn } from "@/lib/ensure-announcement-student-content-locked"
import { ensureAnnouncementAiSummaryColumn } from "@/lib/ensure-announcement-ai-summary"
import { ensureAnnouncementComposerColumns } from "@/lib/ensure-announcement-composer-columns"
import { generateAndSaveAnnouncementAiSummary } from "@/lib/announcement-ai-summary"
import { redactAnnouncementForStudent } from "@/lib/announcement-student-lock"

/**
 * GET /api/announcements/[id]
 * Get a specific announcement with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureAnnouncementStudentContentLockedColumn()
    await ensureAnnouncementAiSummaryColumn()
    await ensureAnnouncementComposerColumns()
    const { id } = await params
    if (instructorIdsDisagree(request)) {
      return NextResponse.json(
        { error: "instructorId query must match x-instructor-id" },
        { status: 400 },
      )
    }

    const studentIdParam = studentIdParamFromRequest(request)
    const instructorClaimed = instructorIdFromRequest(request) != null

    if (!studentIdParam && !instructorClaimed) {
      return NextResponse.json(
        { error: "Student or instructor authentication required" },
        { status: 401 },
      )
    }

    let studentDbId: number | null = null
    let instructorId: number | null = null
    let visibilityFilter: Awaited<ReturnType<typeof studentAnnouncementsWhereClause>> | null = null
    if (studentIdParam) {
      const auth = await requireBoundStudentCaller(request, studentIdParam)
      if (!auth.ok) return auth.response
      studentDbId = auth.studentDbId
      const scope = await resolveStudentAnnouncementsScope(studentDbId)
      if (!scope) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }
      visibilityFilter = await studentAnnouncementsWhereClause(scope)
    } else {
      const session = await requireInstructorSession(request)
      if (!session.ok) return session.response
      instructorId = session.instructorId
    }

    const result = studentDbId && visibilityFilter
      ? await sql`
      SELECT 
        a.*,
        i.name as author_name,
        i.email as author_email,
        (SELECT COUNT(*)::int FROM announcement_views WHERE announcement_id = a.id) as views_count,
        (SELECT COUNT(*)::int FROM announcement_reactions WHERE announcement_id = a.id) as reactions_count,
        (SELECT COUNT(*)::int FROM announcement_comments WHERE announcement_id = a.id) as comments_count
      FROM announcements a
      LEFT JOIN instructors i ON a.author_id = i.id
      WHERE a.id = ${id} AND ${visibilityFilter}
    `
      : await sql`
      SELECT 
        a.*,
        i.name as author_name,
        i.email as author_email,
        (SELECT COUNT(*)::int FROM announcement_views WHERE announcement_id = a.id) as views_count,
        (SELECT COUNT(*)::int FROM announcement_reactions WHERE announcement_id = a.id) as reactions_count,
        (SELECT COUNT(*)::int FROM announcement_comments WHERE announcement_id = a.id) as comments_count
      FROM announcements a
      LEFT JOIN instructors i ON a.author_id = i.id
      WHERE a.id = ${id}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    const announcement = result[0]

    if (!studentDbId && instructorId != null) {
      const allowed = await instructorCanAccessAnnouncement(instructorId, announcement)
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Get reactions breakdown
    const reactionsBreakdown = await sql`
      SELECT 
        reaction_type,
        COUNT(*) as count
      FROM announcement_reactions
      WHERE announcement_id = ${id}
      GROUP BY reaction_type
    `

    announcement.reactions_breakdown = reactionsBreakdown.reduce((acc, r) => {
      acc[r.reaction_type] = Number(r.count)
      return acc
    }, {} as Record<string, number>)

    announcement.attachments = parseAnnouncementAttachments(announcement.attachments)

    // If student is viewing, check their reaction status
    if (studentDbId) {
      const myReaction = await sql`
        SELECT reaction_type
        FROM announcement_reactions
        WHERE announcement_id = ${id} AND student_id = ${studentDbId}
      `

      announcement.my_reaction = myReaction.length > 0 ? myReaction[0].reaction_type : null
      
      const viewed = await sql`
        SELECT 1
        FROM announcement_views
        WHERE announcement_id = ${id} AND student_id = ${studentDbId}
      `
      
      announcement.viewed_by_me = viewed.length > 0

      try {
        const linked = await sql`
          SELECT id
          FROM calendar_events
          WHERE student_id = ${studentDbId}
            AND related_type = 'announcement'
            AND related_id = ${Number(id)}
          LIMIT 1
        `
        announcement.calendar_event_id = linked[0]?.id ?? null
      } catch {
        announcement.calendar_event_id = null
      }
    }

    const payload = studentDbId ? redactAnnouncementForStudent(announcement) : announcement
    return NextResponse.json({ announcement: payload })
  } catch (error) {
    console.error("[Announcements] GET by ID error:", error)
    return NextResponse.json({ error: "Failed to fetch announcement" }, { status: 500 })
  }
}

/**
 * PUT /api/announcements/[id]
 * Update an announcement (author or course-scoped faculty)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureAnnouncementStudentContentLockedColumn()
    await ensureAnnouncementAiSummaryColumn()
    await ensureAnnouncementComposerColumns()
    const { id } = await params
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const {
      title,
      content,
      pinned,
      allow_reactions,
      allow_comments,
      attachments,
      student_content_locked,
      type,
      priority,
      target_session,
      expires_at,
      event_date,
      event_time,
      event_end,
      event_location,
    } = body

    // Verify author or course-scoped faculty access (primary instructor / TA)
    const existing = await sql`
      SELECT author_id, course_id FROM announcements WHERE id = ${id}
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    const canEdit = await instructorCanAccessAnnouncement(scope.instructorId, existing[0])

    if (!canEdit) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Build dynamic update query
    const updates = []
    const values: any = { id: Number(id) }

    if (title !== undefined) {
      updates.push('title = ${title}')
      values.title = title
    }
    if (content !== undefined) {
      updates.push('content = ${content}')
      values.content = content
    }
    if (pinned !== undefined) {
      updates.push('pinned = ${pinned}')
      values.pinned = pinned
    }
    if (allow_reactions !== undefined) {
      updates.push('allow_reactions = ${allow_reactions}')
      values.allow_reactions = allow_reactions
    }
    if (allow_comments !== undefined) {
      updates.push('allow_comments = ${allow_comments}')
      values.allow_comments = allow_comments
    }
    if (attachments !== undefined) {
      if (Array.isArray(attachments)) {
        for (const att of attachments) {
          const url = typeof att?.url === "string" ? att.url : ""
          if (isInvalidPersistedAttachmentUrl(url)) {
            const name = typeof att?.name === "string" ? att.name : "Attachment"
            return NextResponse.json(
              { error: `"${name}" must be uploaded to the server before saving. Remove it and add the file again.` },
              { status: 400 },
            )
          }
        }
      }
      updates.push('attachments = ${attachments}')
      values.attachments = JSON.stringify(sanitizeAnnouncementAttachments(attachments))
    }
    if (student_content_locked !== undefined) {
      updates.push('student_content_locked = ${student_content_locked}')
      values.student_content_locked = student_content_locked === true
    }
    if (type !== undefined) {
      updates.push("type = ${type}")
      values.type = String(type)
    }
    if (priority !== undefined) {
      updates.push("priority = ${priority}")
      values.priority = String(priority)
    }
    if (target_session !== undefined) {
      updates.push("target_session = ${target_session}")
      values.target_session = String(target_session)
    }
    if (expires_at !== undefined) {
      updates.push("expires_at = ${expires_at}")
      values.expires_at = expires_at ? String(expires_at) : null
    }
    if (event_date !== undefined) {
      values.event_date = event_date ? String(event_date) : null
    }
    if (event_time !== undefined) {
      values.event_time = event_time ? String(event_time) : null
    }
    if (event_end !== undefined) {
      values.event_end = event_end ? String(event_end) : null
    }
    if (event_location !== undefined) {
      values.event_location = event_location ? String(event_location) : null
    }

    if (
      updates.length === 0 &&
      values.event_date === undefined &&
      values.event_time === undefined &&
      values.event_end === undefined &&
      values.event_location === undefined
    ) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const result = await sql`
      UPDATE announcements
      SET 
        title = COALESCE(${values.title || null}, title),
        content = COALESCE(${values.content || null}, content),
        pinned = COALESCE(${values.pinned !== undefined ? values.pinned : null}, pinned),
        allow_reactions = COALESCE(${values.allow_reactions !== undefined ? values.allow_reactions : null}, allow_reactions),
        allow_comments = COALESCE(${values.allow_comments !== undefined ? values.allow_comments : null}, allow_comments),
        attachments = COALESCE(${values.attachments || null}::jsonb, attachments),
        student_content_locked = COALESCE(${values.student_content_locked !== undefined ? values.student_content_locked : null}, student_content_locked),
        type = COALESCE(${values.type || null}, type),
        priority = COALESCE(${values.priority || null}, priority),
        target_session = COALESCE(${values.target_session || null}, target_session),
        expires_at = COALESCE(${values.expires_at || null}, expires_at),
        event_date = COALESCE(${values.event_date !== undefined ? values.event_date : null}, event_date),
        event_time = COALESCE(${values.event_time !== undefined ? values.event_time : null}, event_time),
        event_end = COALESCE(${values.event_end !== undefined ? values.event_end : null}, event_end),
        event_location = COALESCE(${values.event_location !== undefined ? values.event_location : null}, event_location),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `

    const updated = result[0]

    if (
      values.event_date !== undefined ||
      values.event_time !== undefined ||
      values.event_end !== undefined ||
      values.event_location !== undefined ||
      values.title !== undefined
    ) {
      try {
        const datePart = String(updated.event_date ?? "").slice(0, 10)
        const startClock = String(updated.event_time ?? "09:00").slice(0, 5)
        const endClock = String(updated.event_end ?? startClock).slice(0, 5)
        if (datePart) {
          const startIso = `${datePart}T${startClock}:00`
          const endIso = `${datePart}T${endClock}:00`
          await sql`
            UPDATE calendar_events
            SET
              title = COALESCE(${values.title || null}, title),
              start_time = ${startIso},
              end_time = ${endIso},
              location = COALESCE(${values.event_location !== undefined ? values.event_location : null}, location),
              updated_at = NOW()
            WHERE related_type = 'announcement'
              AND related_id = ${Number(id)}
          `
        }
      } catch (syncError) {
        console.error("[Announcements] calendar event sync failed:", syncError)
      }
    }

    if (values.title !== undefined || values.content !== undefined) {
      try {
        const aiSummary = await generateAndSaveAnnouncementAiSummary({
          announcementId: Number(id),
          title: String(updated.title ?? ""),
          content: String(updated.content ?? ""),
        })
        updated.ai_summary = aiSummary
      } catch (summaryError) {
        console.error("[Announcements] AI summary regeneration failed:", summaryError)
      }
    }

    const notifyCourseId =
      updated?.course_id != null && Number.isFinite(Number(updated.course_id))
        ? Number(updated.course_id)
        : null

    if (notifyCourseId != null) {
      try {
        const { notifyStudentsForAnnouncement } = await import("@/lib/announcement-notifications")
        const notified = await notifyStudentsForAnnouncement({
          courseId: notifyCourseId,
          title: updated.title,
          content: updated.content,
          announcementId: Number(id),
        })
        if (notified > 0) {
          console.log(`[Announcements] Backfilled ${notified} notification(s) for course ${notifyCourseId}`)
        }
      } catch (notificationError) {
        console.error("[Announcements] Failed to backfill notifications on update:", notificationError)
      }
    }

    return NextResponse.json({ 
      announcement: {
        ...updated,
        attachments: parseAnnouncementAttachments(updated.attachments),
      },
      message: "Announcement updated successfully" 
    })
  } catch (error) {
    console.error("[Announcements] PUT error:", error)
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 })
  }
}

/**
 * DELETE /api/announcements/[id]
 * Delete an announcement (instructor only, must be author)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const existing = await sql`
      SELECT author_id, course_id FROM announcements WHERE id = ${id}
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    const canDelete = await instructorCanAccessAnnouncement(scope.instructorId, existing[0])
    if (!canDelete) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    await sql`
      DELETE FROM announcements WHERE id = ${id}
    `

    return NextResponse.json({ message: "Announcement deleted successfully" })
  } catch (error) {
    console.error("[Announcements] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 })
  }
}

