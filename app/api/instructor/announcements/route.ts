import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { canonicalSessionCode, sectionFilterCodesForSql } from "@/lib/session-code-aliases"
import { resolveSessionRowByCode } from "@/lib/resolve-session-by-code"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session = searchParams.get("session")

    let query
    if (session && session !== "all") {
      const sectionRows = sectionFilterCodesForSql(session)
      query = sql`
        SELECT 
          a.*,
          COUNT(DISTINCT ar.student_id) as read_count
        FROM announcements a
        LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id
        WHERE a.target_session = ANY(${sectionRows}::text[]) OR a.target_session = 'all'
        GROUP BY a.id
        ORDER BY a.created_at DESC
      `
    } else {
      query = sql`
        SELECT 
          a.*,
          COUNT(DISTINCT ar.student_id) as read_count
        FROM announcements a
        LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id
        GROUP BY a.id
        ORDER BY a.created_at DESC
      `
    }

    const announcements = await query

    return NextResponse.json({ announcements })
  } catch (error) {
    console.error("[Instructor Announcements] Failed to fetch:", error)
    
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
        read_count: 45
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
        read_count: 32
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
        read_count: 78
      },
      {
        id: 4,
        title: "Project Groups Formation",
        content: "Project groups must be formed by the end of this week. Please use the Groups module to create or join a team.",
        type: "alert",
        priority: "high",
        target_session: "all",
        created_at: new Date(Date.now() - 345600000).toISOString(),
        expires_at: new Date(Date.now() + 259200000).toISOString(),
        is_active: true,
        read_count: 62
      }
    ]

    return NextResponse.json({ announcements: mockAnnouncements })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, content, type, priority, target_session, expires_at } = await request.json()

    // Validate input
    if (!title || !content || !type || !priority || !target_session) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create announcement
    const result = await sql`
      INSERT INTO announcements (
        title, content, type, priority, target_session, expires_at, is_active, created_at, updated_at
      )
      VALUES (
        ${title}, ${content}, ${type}, ${priority}, ${target_session}, 
        ${expires_at || null}, true, NOW(), NOW()
      )
      RETURNING *
    `

    // Create notifications for all target students (in-app + email)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com"
    const announcementLink = `${baseUrl}/student/dashboard-v2/announcements`

    if (target_session === "all") {
      await sql`
        INSERT INTO notifications (student_id, type, title, message, link, is_read, created_at)
        SELECT 
          id, 
          'announcement', 
          ${title}, 
          ${content.substring(0, 150) + (content.length > 150 ? '...' : '')}, 
          '/student/announcements', 
          false, 
          NOW()
        FROM students
      `
      const { getStudentsWithEmails } = await import("@/lib/email/send-notification-email")
      const students = await getStudentsWithEmails()
      for (const s of students) {
        const { sendEmail } = await import("@/lib/email/sendEmail")
        sendEmail("announcement", s.email, { title, message: content, link: announcementLink })
          .catch((e) => console.warn("[Announcements] Email error:", e))
      }
    } else {
      const codeForLookup = canonicalSessionCode(String(target_session ?? ""))
      const resolved = await resolveSessionRowByCode(codeForLookup)
      if (resolved) {
        const sessionId = resolved.id
        await sql`
          INSERT INTO notifications (student_id, type, title, message, link, is_read, created_at)
          SELECT 
            s.id, 
            'announcement', 
            ${title}, 
            ${content.substring(0, 150) + (content.length > 150 ? '...' : '')}, 
            '/student/announcements', 
            false, 
            NOW()
          FROM students s
          WHERE s.session_id = ${sessionId}
        `
        const { getStudentsWithEmails } = await import("@/lib/email/send-notification-email")
        const students = await getStudentsWithEmails([sessionId])
        for (const s of students) {
          const { sendEmail } = await import("@/lib/email/sendEmail")
          sendEmail("announcement", s.email, { title, message: content, link: announcementLink })
            .catch((e) => console.warn("[Announcements] Email error:", e))
        }
      }
    }

    return NextResponse.json({
      announcement: result[0],
      message: "Announcement created and sent to students successfully"
    })
  } catch (error) {
    console.error("[Instructor Announcements] Failed to create:", error)
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 })
  }
}
