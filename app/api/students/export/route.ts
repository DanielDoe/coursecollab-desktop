import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { exportStudentsToPDF, type StudentData } from "@/lib/pdf-export"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"
export const maxDuration = 60

/**
 * GET /api/students/export
 * 
 * Export students data to PDF
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

    console.log("[Students Export] Fetching students data:", { session, status })

    // Build query
    let studentsQuery = sql`
      SELECT 
        s.id,
        s.student_id,
        s.full_name,
        s.section,
        s.email,
        s.phone,
        s.is_active,
        s.created_at
      FROM students s
      WHERE 1=1
    `

    if (session && session !== "all") {
      studentsQuery = sql`${studentsQuery} AND s.section = ${session}`
    }

    if (status && status !== "all") {
      if (status === "active") {
        studentsQuery = sql`${studentsQuery} AND s.is_active = true`
      } else if (status === "inactive") {
        studentsQuery = sql`${studentsQuery} AND s.is_active = false`
      }
    }

    studentsQuery = sql`${studentsQuery} ORDER BY s.full_name ASC`

    const students = await studentsQuery

    // Transform data
    const studentsData: StudentData[] = students.map((s: any) => ({
      id: s.id,
      student_id: s.student_id,
      full_name: s.full_name,
      section: s.section,
      email: s.email || "",
      phone: s.phone || "",
      is_active: s.is_active,
      created_at: s.created_at
    }))

    console.log("[Students Export] Found", studentsData.length, "students")

    if (format === "pdf") {
      // Generate PDF
      const pdf = exportStudentsToPDF(studentsData, {
        title: "Students Report",
        subtitle: session ? `Session: ${session}` : "All Sessions",
        primaryColor: [34, 197, 94], // Green
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
          "Content-Disposition": `attachment; filename="students-report-${session || "all"}-${Date.now()}.pdf"`,
          "Content-Length": buffer.length.toString()
        }
      })
    }

    // JSON format (fallback)
    return NextResponse.json({
      students: studentsData,
      count: studentsData.length,
      exportedAt: new Date().toISOString()
    })

  } catch (error: any) {
    console.error("[Students Export] Error:", error)
    return NextResponse.json(
      { error: "Failed to export students", details: error.message },
      { status: 500 }
    )
  }
}

