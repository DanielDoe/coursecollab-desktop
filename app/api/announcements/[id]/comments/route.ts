import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { assertAnnouncementUnlockedForStudent } from "@/lib/announcement-student-lock-server"
import {
  instructorCanAccessAnnouncement,
  instructorIdFromRequest,
  studentIdParamFromRequest,
} from "@/lib/announcement-request-auth"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import {
  resolveStudentAnnouncementsScope,
  studentAnnouncementsWhereClause,
} from "@/lib/student-announcements-scope"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

/**
 * GET /api/announcements/[id]/comments
 * Get all comments for an announcement
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const studentIdParam = studentIdParamFromRequest(request)
    const instructorClaimed = instructorIdFromRequest(request) != null

    let studentDbId: number | null = null
    let instructorId: number | null = null

    if (instructorClaimed && !studentIdParam) {
      const session = await requireInstructorSession(request)
      if (!session.ok) return session.response
      instructorId = session.instructorId
    } else {
      const auth = await requireBoundStudentCaller(request, studentIdParam)
      if (!auth.ok) {
        if (studentIdParam) return auth.response
        const session = await requireInstructorSession(request)
        if (!session.ok) return auth.response
        instructorId = session.instructorId
      } else {
        studentDbId = auth.studentDbId
      }
    }

    if (studentDbId != null) {
      const scope = await resolveStudentAnnouncementsScope(studentDbId)
      if (!scope) {
        return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
      }
      const visibilityFilter = await studentAnnouncementsWhereClause(scope)
      const visible = await sql`
        SELECT a.id FROM announcements a
        WHERE a.id = ${id} AND ${visibilityFilter}
      `
      if (visible.length === 0) {
        return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
      }
    } else if (instructorId != null) {
      const existing = await sql`
        SELECT author_id, course_id FROM announcements WHERE id = ${id}
      `
      if (existing.length === 0) {
        return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
      }
      const allowed = await instructorCanAccessAnnouncement(instructorId, existing[0])
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else {
      return NextResponse.json(
        { error: "Student or instructor authentication required" },
        { status: 401 },
      )
    }

    const comments = await sql`
      SELECT 
        c.id,
        c.content,
        c.created_at,
        c.updated_at,
        s.id as student_id,
        s.full_name as student_name
      FROM announcement_comments c
      JOIN students s ON c.student_id = s.id
      WHERE c.announcement_id = ${id}
      ORDER BY c.created_at ASC
    `

    return NextResponse.json({ comments })
  } catch (error) {
    console.error("[Comments] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}

/**
 * POST /api/announcements/[id]/comments
 * Create a new comment on an announcement
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { studentId, content } = body

    const auth = await requireBoundStudentCaller(
      request,
      studentId != null ? String(studentId) : null,
    )
    if (!auth.ok) return auth.response

    if (!content || content.trim() === "") {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 })
    }

    // Check if comments are allowed on this announcement
    const announcement = await sql`
      SELECT allow_comments FROM announcements WHERE id = ${id}
    `

    if (announcement.length === 0) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    if (!announcement[0].allow_comments) {
      return NextResponse.json({ error: "Comments are not allowed on this announcement" }, { status: 403 })
    }

    const lockState = await assertAnnouncementUnlockedForStudent(Number(id))
    if (lockState.locked) {
      return NextResponse.json(
        { error: "Comments are locked until your instructor unlocks this announcement." },
        { status: 403 },
      )
    }

    // Create the comment
    const result = await sql`
      INSERT INTO announcement_comments (announcement_id, student_id, content)
      VALUES (${id}, ${auth.studentDbId}, ${content})
      RETURNING *
    `

    const comment = result[0]

    // Get student info for the response
    const studentInfo = await sql`
      SELECT id, full_name FROM students WHERE id = ${auth.studentDbId}
    `

    return NextResponse.json({ 
      comment: {
        ...comment,
        student_id: studentInfo[0].id,
        student_name: studentInfo[0].full_name
      },
      message: "Comment posted successfully" 
    }, { status: 201 })
  } catch (error) {
    console.error("[Comments] POST error:", error)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }
}

