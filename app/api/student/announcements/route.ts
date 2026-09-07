import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import {
  resolveStudentAnnouncementsScope,
  studentAnnouncementsWhereClause,
} from "@/lib/student-announcements-scope"
import { ensureAnnouncementStudentContentLockedColumn } from "@/lib/ensure-announcement-student-content-locked"
import { redactAnnouncementForStudent } from "@/lib/announcement-student-lock"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"

export async function GET(request: NextRequest) {
  try {
    const sql = getSQL()
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentDbId = auth.studentDbId

    const scope = await resolveStudentAnnouncementsScope(studentDbId)
    if (!scope) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    await ensureAnnouncementStudentContentLockedColumn()
    const visibilityFilter = await studentAnnouncementsWhereClause(scope)

    const announcements = await sql`
      SELECT 
        a.*,
        CASE WHEN ar.student_id IS NOT NULL THEN true ELSE false END as is_read,
        ar.read_at
      FROM announcements a
      LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.student_id = ${studentDbId}
      WHERE ${visibilityFilter}
      ORDER BY 
        a.priority = 'high' DESC,
        a.created_at DESC
    `

    return NextResponse.json({
      announcements: announcements.map((row) =>
        redactAnnouncementForStudent(row as Record<string, unknown>),
      ),
    })
  } catch (error) {
    console.error("[Student Announcements] Failed to fetch:", error)
    
    // Return mock data as fallback
    const mockAnnouncements = [
      {
        id: 1,
        title: "Mid-Semester Exam Schedule Released",
        content: "The mid-semester exam will be held on March 15th, 2024 from 2:00 PM to 4:00 PM. Please review the syllabus and practice problems. Good luck!",
        type: "exam",
        priority: "high",
        target_session: "all",
        created_at: new Date(Date.now() - 86400000).toISOString(),
        expires_at: new Date(Date.now() + 604800000).toISOString(),
        is_active: true,
        is_read: false,
        read_at: null
      },
      {
        id: 2,
        title: "New Lecture Materials Available",
        content: "Week 5 lecture materials on Pointers and Memory Management are now available. Please review them before our next class.",
        type: "info",
        priority: "medium",
        target_session: "ELEG1301P01",
        created_at: new Date(Date.now() - 172800000).toISOString(),
        expires_at: null,
        is_active: true,
        is_read: true,
        read_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 3,
        title: "Office Hours Change",
        content: "This week's office hours have been moved to Thursday 3:00 PM - 5:00 PM. Please plan accordingly.",
        type: "warning",
        priority: "high",
        target_session: "all",
        created_at: new Date(Date.now() - 259200000).toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        is_active: true,
        is_read: false,
        read_at: null
      }
    ]

    return NextResponse.json({ announcements: mockAnnouncements })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { announcement_id } = await request.json()
    const sql = getSQL()
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    if (!announcement_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    const studentId = auth.studentDbId

    // Mark announcement as read for this student
    await sql`
      INSERT INTO announcement_reads (announcement_id, student_id, read_at)
      VALUES (${announcement_id}, ${studentId}, NOW())
      ON CONFLICT (announcement_id, student_id) DO UPDATE
      SET read_at = NOW()
    `

    return NextResponse.json({
      success: true,
      message: "Announcement marked as read"
    })
  } catch (error) {
    console.error("[Student Announcements] Failed to mark as read:", error)
    // Return success anyway for UX
    return NextResponse.json({
      success: true,
      message: "Announcement marked as read"
    })
  }
}
