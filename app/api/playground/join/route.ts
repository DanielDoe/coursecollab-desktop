import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { hasActiveDonationTrial } from "@/lib/membership"
import { normalizePlaygroundPasscode } from "@/lib/playground-passcode"
import { deductPlaygroundJoinCredit } from "@/lib/playground-join-credits"
import { resolvePlaygroundStudentName } from "@/lib/playground-display-name"
import { PLAYGROUND_ALREADY_JOINED_MESSAGE, isPlaygroundWaitingRoomResult } from "@/lib/playground-join-guard"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { studentName, studentId, mode, nickname, passcode, practiceSetId } = await request.json()

    const bound = await requireBoundStudentCaller(request, studentId)
    if (!bound.ok) return bound.response

    if (!studentName || !mode) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const studentDatabaseId = bound.studentDbId

    const studentProfile = await sql`
      SELECT student_id, full_name FROM students
      WHERE id = ${studentDatabaseId} AND deleted_at IS NULL
      LIMIT 1
    `
    if (studentProfile.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const rosterStudentId = String(studentProfile[0].student_id)
    const resolvedStudentName = resolvePlaygroundStudentName(
      studentName,
      rosterStudentId,
      studentProfile[0].full_name as string,
    )
    const trimmedNickname = typeof nickname === "string" ? nickname.trim() : ""
    const storedNickname = trimmedNickname.length > 0 ? trimmedNickname : null

    if (mode === "CLASSROOM") {
      const studentInfo = await sql`
        SELECT session_id FROM students WHERE id = ${studentDatabaseId} LIMIT 1
      `
      const studentSessionId = studentInfo.length > 0 ? studentInfo[0].session_id : null

      const joinCode = normalizePlaygroundPasscode(passcode)
      if (joinCode.length !== 5) {
        return NextResponse.json(
          { error: "Enter the 5-character passcode from your instructor" },
          { status: 400 },
        )
      }

      const matchedSessions = await sql`
        SELECT
          id,
          duration_sec,
          current_question_index,
          allowed_sessions,
          game_started,
          is_active,
          join_passcode,
          question_count
        FROM playground_sessions
        WHERE mode = 'CLASSROOM'
          AND is_active = true
          AND UPPER(join_passcode) = ${joinCode}
        LIMIT 1
      `

      if (matchedSessions.length === 0) {
        return NextResponse.json(
          { error: "Invalid passcode. Check with your instructor and try again." },
          { status: 404 },
        )
      }

      const matched = matchedSessions[0] as {
        id: number
        duration_sec: number
        current_question_index: number
        allowed_sessions: number[] | null
        game_started: boolean
        is_active: boolean
        question_count: number
      }

      if (
        matched.allowed_sessions !== null &&
        Array.isArray(matched.allowed_sessions) &&
        matched.allowed_sessions.length > 0 &&
        studentSessionId !== null &&
        !matched.allowed_sessions.includes(studentSessionId)
      ) {
        return NextResponse.json(
          { error: "This passcode is not available for your class section" },
          { status: 403 },
        )
      }

      const sessionId = matched.id
      const durationSec = matched.duration_sec
      const studentIdString = rosterStudentId

      const existingResult = await sql`
        SELECT id, joined_at_question, completed_at, display_name
        FROM playground_results
        WHERE session_id = ${sessionId}
          AND student_id = ${studentIdString}
        ORDER BY id DESC
        LIMIT 1
      `

      if (existingResult.length > 0) {
        const existing = existingResult[0] as {
          id: number
          joined_at_question: number
          completed_at: string | null
          display_name: string
        }

        if (isPlaygroundWaitingRoomResult(existing)) {
          if (storedNickname && storedNickname !== existing.display_name) {
            await sql`
              UPDATE playground_results
              SET nickname = ${storedNickname}, display_name = ${storedNickname}
              WHERE id = ${existing.id}
            `
          }

          return NextResponse.json({
            sessionId,
            resultId: existing.id,
            mode: "CLASSROOM",
            durationSec,
            currentQuestionIndex: matched.game_started ? matched.current_question_index : 0,
            displayName: storedNickname || existing.display_name,
            waitingRoom: !matched.game_started,
            gameStarted: matched.game_started,
            rejoined: true,
          })
        }

        return NextResponse.json(
          {
            error: PLAYGROUND_ALREADY_JOINED_MESSAGE,
            alreadyJoined: true,
          },
          { status: 409 },
        )
      }

      const creditGate = await deductPlaygroundJoinCredit(studentDatabaseId)
      if (!creditGate.allowed) {
        return creditGate.response
      }

      const baseDisplayName = storedNickname || resolvedStudentName
      let displayName = baseDisplayName
      let suffix = 2

      while (true) {
        const existing = await sql`
          SELECT id FROM playground_results
          WHERE session_id = ${sessionId} AND display_name = ${displayName}
        `
        if (existing.length === 0) break
        displayName = `${baseDisplayName} (${suffix})`
        suffix++
      }

      const joinedAtQuestion = matched.game_started ? matched.current_question_index : -1

      const result = await sql`
        INSERT INTO playground_results (
          session_id, student_id, student_name, nickname, display_name,
          score, joined_at_question
        )
        VALUES (
          ${sessionId}, ${studentIdString}, ${resolvedStudentName}, ${storedNickname},
          ${displayName}, 0, ${joinedAtQuestion}
        )
        RETURNING id
      `

      return NextResponse.json({
        sessionId,
        resultId: result[0].id,
        mode: "CLASSROOM",
        durationSec,
        currentQuestionIndex: matched.game_started ? matched.current_question_index : 0,
        displayName,
        waitingRoom: !matched.game_started,
        gameStarted: matched.game_started,
        creditsRemaining: creditGate.unlimited ? 999999 : creditGate.creditsRemaining,
      })
    }

    const creditGate = await deductPlaygroundJoinCredit(studentDatabaseId)
    if (!creditGate.allowed) {
      return creditGate.response
    }

    let personalDurationSec = 10
    let personalSelectedTopics: string[] | null = null
    let personalQuestionCount: number | null = null
    let templateSessionId: number | null = null

    if (practiceSetId != null && practiceSetId !== "") {
      const parsedTemplateId = Number(practiceSetId)
      if (!Number.isFinite(parsedTemplateId) || parsedTemplateId <= 0) {
        return NextResponse.json({ error: "Invalid practice set" }, { status: 400 })
      }

      const templateRows = await sql`
        SELECT id, duration_sec, selected_topics, question_count
        FROM playground_sessions
        WHERE id = ${parsedTemplateId}
        LIMIT 1
      `
      if (templateRows.length === 0) {
        return NextResponse.json({ error: "Practice set not found" }, { status: 404 })
      }

      const questionCountRows = await sql`
        SELECT COUNT(*)::int AS cnt
        FROM playground_questions
        WHERE session_id = ${parsedTemplateId}
      `
      const linkedQuestionCount = Number(questionCountRows[0]?.cnt ?? 0)
      if (linkedQuestionCount === 0) {
        return NextResponse.json({ error: "Practice set has no questions" }, { status: 400 })
      }

      const template = templateRows[0] as {
        duration_sec: number
        selected_topics: string[] | null
        question_count: number | null
      }
      personalDurationSec = Number(template.duration_sec) || 10
      personalSelectedTopics = template.selected_topics
      personalQuestionCount = linkedQuestionCount || Number(template.question_count) || null
      templateSessionId = parsedTemplateId
    }

    const newSession = await sql`
      INSERT INTO playground_sessions (
        mode,
        duration_sec,
        is_active,
        current_question_index,
        selected_topics,
        question_count
      )
      VALUES (
        'PERSONAL',
        ${personalDurationSec},
        true,
        0,
        ${personalSelectedTopics},
        ${personalQuestionCount}
      )
      RETURNING id, duration_sec
    `

    const sessionId = newSession[0].id
    const durationSec = newSession[0].duration_sec

    if (templateSessionId != null) {
      await sql`
        INSERT INTO playground_questions (session_id, bank_question_id, question_order)
        SELECT ${sessionId}, bank_question_id, question_order
        FROM playground_questions
        WHERE session_id = ${templateSessionId}
      `
    }
    const displayName = storedNickname || resolvedStudentName

    const result = await sql`
      INSERT INTO playground_results (
        session_id, student_id, student_name, nickname, display_name,
        score, joined_at_question
      )
      VALUES (
        ${sessionId}, ${rosterStudentId}, ${resolvedStudentName}, ${storedNickname},
        ${displayName}, 0, 0
      )
      RETURNING id
    `

    const hasDonationAccessForDisplay = await hasActiveDonationTrial(studentDatabaseId)
    const remainingCredits =
      creditGate.unlimited || hasDonationAccessForDisplay
        ? 999999
        : creditGate.creditsRemaining

    return NextResponse.json({
      sessionId,
      resultId: result[0].id,
      mode: "PERSONAL",
      durationSec,
      currentQuestionIndex: 0,
      displayName,
      creditsRemaining: remainingCredits,
    })
  } catch {
    return NextResponse.json({ error: "Failed to join playground" }, { status: 500 })
  }
}
