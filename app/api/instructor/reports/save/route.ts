import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    if (!instructorSession) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const { reportType, title, data, metadata, filters } = await request.json()

    if (!reportType || !title || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }


    // Get instructor ID from session or header
    const instructorId = request.headers.get("x-instructor-id")
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 401 })
    }

    // Save report to database
    const result = await sql`
      INSERT INTO instructor_reports (
        report_type,
        title,
        data,
        metadata,
        filters,
        generated_by
      ) VALUES (
        ${reportType},
        ${title},
        ${JSON.stringify(data)},
        ${metadata ? JSON.stringify(metadata) : null},
        ${filters ? JSON.stringify(filters) : null},
        ${parseInt(instructorId)}
      ) RETURNING id, created_at
    `

    return NextResponse.json({
      success: true,
      reportId: result[0].id,
      createdAt: result[0].created_at,
      message: "Report saved successfully"
    })

  } catch (error) {
    console.error("Error saving report:", error)
    return NextResponse.json(
      { error: "Failed to save report" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    if (!instructorSession) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const instructorId = request.headers.get("x-instructor-id")
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 401 })
    }


    // Fetch all reports for this instructor
    const reports = await sql`
      SELECT 
        id,
        report_type,
        title,
        data,
        metadata,
        filters,
        generated_at,
        created_at
      FROM instructor_reports
      WHERE generated_by = ${parseInt(instructorId)}
      ORDER BY created_at DESC
    `

    return NextResponse.json({
      success: true,
      reports: reports.map(report => ({
        id: report.id,
        type: report.report_type,
        title: report.title,
        data: report.data,
        metadata: report.metadata,
        filters: report.filters,
        generatedAt: report.generated_at,
        createdAt: report.created_at
      }))
    })

  } catch (error) {
    console.error("Error fetching reports:", error)
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    if (!instructorSession) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const instructorId = request.headers.get("x-instructor-id")
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get("id")

    if (!reportId) {
      return NextResponse.json({ error: "Report ID required" }, { status: 400 })
    }


    // Delete report (only if it belongs to this instructor)
    const result = await sql`
      DELETE FROM instructor_reports
      WHERE id = ${parseInt(reportId)} AND generated_by = ${parseInt(instructorId)}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Report not found or access denied" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: "Report deleted successfully"
    })

  } catch (error) {
    console.error("Error deleting report:", error)
    return NextResponse.json(
      { error: "Failed to delete report" },
      { status: 500 }
    )
  }
}
