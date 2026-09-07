import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAttemptOwnership, requireCallerStudentDbId } from "@/lib/student-api-auth"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const caller = await requireCallerStudentDbId(request)
    if (!caller.ok) return caller.response

    // Check if request body exists and is valid JSON
    const body = await request.text()
    if (!body || body.trim() === "") {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 })
    }

    let parsedBody
    try {
      parsedBody = JSON.parse(body)
    } catch (parseError) {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { attemptId, violation } = parsedBody

    if (!attemptId || !violation) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const ownership = await requireAttemptOwnership(request, Number(attemptId))
    if (!ownership.ok) return ownership.response

    // Update violation counts based on type
    let updateQuery = ""
    switch (violation.type) {
      case "tab_switch":
        updateQuery = `
          UPDATE quiz_attempts 
          SET 
            tab_switch_count = tab_switch_count + 1,
            violation_log = violation_log || $1::jsonb
          WHERE id = $2
          RETURNING tab_switch_count, copy_paste_attempts, mouse_leave_count
        `
        break
      case "copy_attempt":
      case "paste_attempt":
      case "copy_paste":
        updateQuery = `
          UPDATE quiz_attempts 
          SET 
            copy_paste_attempts = copy_paste_attempts + 1,
            violation_log = violation_log || $1::jsonb
          WHERE id = $2
          RETURNING tab_switch_count, copy_paste_attempts, mouse_leave_count
        `
        break
      case "mouse_leave":
        updateQuery = `
          UPDATE quiz_attempts 
          SET 
            mouse_leave_count = mouse_leave_count + 1,
            violation_log = violation_log || $1::jsonb
          WHERE id = $2
          RETURNING tab_switch_count, copy_paste_attempts, mouse_leave_count
        `
        break
      case "gemini_window":
        updateQuery = `
          UPDATE quiz_attempts 
          SET 
            violation_log = violation_log || $1::jsonb
          WHERE id = $2
          RETURNING tab_switch_count, copy_paste_attempts, mouse_leave_count
        `
        break
      default:
        updateQuery = `
          UPDATE quiz_attempts 
          SET violation_log = violation_log || $1::jsonb
          WHERE id = $2
          RETURNING tab_switch_count, copy_paste_attempts, mouse_leave_count
        `
    }

    // Execute the appropriate query based on violation type
    let result
    switch (violation.type) {
      case "tab_switch":
        result = await sql`
          UPDATE quiz_attempts 
          SET 
            tab_switch_count = tab_switch_count + 1,
            violation_log = violation_log || ${JSON.stringify([violation])}::jsonb
          WHERE id = ${attemptId}
          RETURNING tab_switch_count, copy_paste_attempts, mouse_leave_count
        `
        break
      case "copy_attempt":
      case "paste_attempt":
      case "copy_paste":
        result = await sql`
          UPDATE quiz_attempts 
          SET 
            copy_paste_attempts = copy_paste_attempts + 1,
            violation_log = violation_log || ${JSON.stringify([violation])}::jsonb
          WHERE id = ${attemptId}
          RETURNING tab_switch_count, copy_paste_attempts, mouse_leave_count
        `
        break
      case "mouse_leave":
        result = await sql`
          UPDATE quiz_attempts 
          SET 
            mouse_leave_count = mouse_leave_count + 1,
            violation_log = violation_log || ${JSON.stringify([violation])}::jsonb
          WHERE id = ${attemptId}
          RETURNING tab_switch_count, copy_paste_attempts, mouse_leave_count
        `
        break
      case "gemini_window":
        // Enhanced logging for Gemini detection events
        const geminiEvent = violation.details || violation.reason || "Gemini window detected"
        const eventType = violation.eventType || "detected" // 'detected', 'dismissed', 'active', 'cleared'
        
        console.log(`[Gemini Violation Log] Attempt ${attemptId}: ${eventType} - ${geminiEvent}`, {
          attemptId,
          eventType,
          reason: geminiEvent,
          timestamp: new Date().toISOString(),
          violation: violation
        })
        
        // Only increment strike count on 'detected' events, not on 'dismissed' or 'active' events
        if (eventType === "detected") {
          result = await sql`
            UPDATE quiz_attempts 
            SET 
              gemini_strikes_count = COALESCE(gemini_strikes_count, 0) + 1,
              violation_log = COALESCE(violation_log, '[]'::jsonb) || ${JSON.stringify([{
                ...violation,
                eventType: eventType,
                timestamp: new Date().toISOString()
              }])}::jsonb
            WHERE id = ${attemptId}
            RETURNING tab_switch_count, copy_paste_attempts, mouse_leave_count, gemini_strikes_count
          `
        } else {
          // Log the event but don't increment strike count
          result = await sql`
            UPDATE quiz_attempts 
            SET 
              violation_log = COALESCE(violation_log, '[]'::jsonb) || ${JSON.stringify([{
                ...violation,
                eventType: eventType,
                timestamp: new Date().toISOString()
              }])}::jsonb
            WHERE id = ${attemptId}
            RETURNING tab_switch_count, copy_paste_attempts, mouse_leave_count, gemini_strikes_count
          `
        }
        break
      default:
        result = await sql`
          UPDATE quiz_attempts 
          SET violation_log = violation_log || ${JSON.stringify([violation])}::jsonb
          WHERE id = ${attemptId}
          RETURNING tab_switch_count, copy_paste_attempts, mouse_leave_count
        `
    }
    const [updateResult] = result

    return NextResponse.json({
      success: true,
      counts: updateResult || {
        tab_switch_count: 0,
        copy_paste_attempts: 0,
        mouse_leave_count: 0,
        gemini_strikes_count: 0,
      },
    })
  } catch (error) {
    // Log error without exposing details to client
    return NextResponse.json({ error: "Failed to log violation" }, { status: 500 })
  }
}

