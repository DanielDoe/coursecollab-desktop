import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email/sendEmail"

export const dynamic = "force-dynamic"

/**
 * GET /api/test-email
 * Test endpoint to verify email service configuration
 * In production, protect this route or remove it
 */
export async function GET() {
  try {
    const result = await sendEmail(
      "quiz_available",
      "test@example.com",
      { quizTitle: "Test Quiz - Midterm Practice" }
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully (check test@example.com if configured)",
    })
  } catch (error) {
    console.error("[test-email] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
