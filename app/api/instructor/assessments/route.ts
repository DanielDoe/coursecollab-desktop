import { type NextRequest, NextResponse } from "next/server"

/**
 * DEPRECATED: This route is deprecated in favor of assessment-specific routes
 * 
 * Use instead:
 * - /api/quiz/list
 * - /api/homework/list
 * - /api/midsem/list
 * - /api/final/list
 * 
 * This route is kept for backward compatibility but redirects to the new routes.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const instructorId = searchParams.get("instructorId")
    const assessmentType = searchParams.get("assessmentType") || "quiz"
    const session = searchParams.get("session")
    const status = searchParams.get("status")
    const saved = searchParams.get("saved")

    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    // Map assessment types to new API routes
    const typeMap: Record<string, string> = {
      'quiz': 'quiz',
      'homework': 'homework',
      'mid_semester': 'midsem',
      'midsem': 'midsem',
      'final': 'final',
      'finals': 'final'
    }

    const normalizedType = typeMap[assessmentType] || 'quiz'

    // Build query params for new route
    const params = new URLSearchParams()
    params.append('instructorId', instructorId)
    if (session && session !== "all") params.append('session', session)
    if (status && status !== "all") params.append('status', status)
    if (saved === "true") params.append('saved', 'true')

    // Redirect to new assessment-specific route
    const newUrl = `/api/${normalizedType}/list?${params.toString()}`
    
    // For backward compatibility, fetch from new route and return in old format
    const response = await fetch(`${request.nextUrl.origin}${newUrl}`)
    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.error || "Failed to fetch assessments" }, { status: response.status })
    }

    // Transform response to match old format
    return NextResponse.json({
      assessments: (data.assessments || []).map((assessment: any) => ({
        ...assessment,
        assessment_type: assessmentType // Add for backward compatibility
      })),
      assessmentType,
      total: (data.assessments || []).length,
    })
  } catch (error) {
    console.error("Error fetching instructor assessments:", error)
    return NextResponse.json({ error: "Failed to fetch assessments" }, { status: 500 })
  }
}

/**
 * DEPRECATED: Use /api/[assessmentType]/create instead
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      time_limit,
      assessment_type,
      instructor_id,
      available_from,
      available_until,
      session_access,
    } = body

    if (!title || !instructor_id) {
      return NextResponse.json({ error: "Title and instructor ID are required" }, { status: 400 })
    }

    // Map to normalized type
    const typeMap: Record<string, string> = {
      'quiz': 'quiz',
      'homework': 'homework',
      'mid_semester': 'midsem',
      'midsem': 'midsem',
      'final': 'final',
      'finals': 'final'
    }

    const normalizedType = typeMap[assessment_type || 'quiz'] || 'quiz'

    // Redirect to new create route
    const createUrl = `${request.nextUrl.origin}/api/${normalizedType}/create`
    const response = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        time_per_question: time_limit || 60,
        available_from,
        available_until,
        questions: [], // Empty - questions should be added separately
        sendNotifications: false,
        instructorId: instructor_id
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.error || "Failed to create assessment" }, { status: response.status })
    }

    return NextResponse.json({
      success: true,
      assessmentId: data.id,
      message: `${assessment_type || 'Assessment'} created successfully`,
    })
  } catch (error) {
    console.error("Error creating instructor assessment:", error)
    return NextResponse.json({ error: "Failed to create assessment" }, { status: 500 })
  }
}
