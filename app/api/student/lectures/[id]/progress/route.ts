import { NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import { withLectureProgressTriggersDisabled } from "@/lib/lecture-progress-triggers"
import { requireStudentLectureCaller } from "@/lib/require-student-lecture-auth"
import { isLectureAccessibleToStudent } from "@/lib/student-lecture-access"

const sql = getSQL()

function parseSlideList(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0))].sort(
    (a, b) => a - b,
  )
}

function deriveStatus(
  totalSlides: number,
  completedCount: number,
  currentSlide: number,
  timeSpentSeconds: number,
  previousStatus?: string | null,
): "not_started" | "in_progress" | "completed" {
  if (previousStatus === "completed") return "completed"
  if (totalSlides > 0 && completedCount >= totalSlides) return "completed"
  if (completedCount > 0 || currentSlide > 0 || timeSpentSeconds > 0) return "in_progress"
  return "not_started"
}

function deriveProgressPercentage(totalSlides: number, completedCount: number, currentSlide: number): number {
  if (totalSlides > 0) {
    return Math.min(100, Math.round((completedCount / totalSlides) * 100))
  }
  if (currentSlide > 0) return Math.min(15, currentSlide)
  return 0
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const lectureId = parseInt(id, 10)
    const body = await request.json()
    const {
      student_id,
      studentId,
      current_slide,
      completed_slides,
      total_slides,
      bookmarked,
      confused,
      time_spent_seconds,
      notes,
      mark_completed,
    } = body
    // Students can declare a lecture done even when slide tracking says otherwise
    // (skimmed a deck, read it elsewhere). `null` means "just record activity".
    const manualCompletion = typeof mark_completed === "boolean" ? mark_completed : null

    const auth = await requireStudentLectureCaller(request, student_id ?? studentId ?? null)
    if (!auth.ok) return auth.response
    const allowed = await isLectureAccessibleToStudent(auth.sessionRow.student_id, lectureId)
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const studentDbId = auth.studentDbId
    const currentSlide = Math.max(0, Number(current_slide) || 0)
    const incomingCompleted = parseSlideList(completed_slides)
    const totalSlidesParam = Math.max(0, Number(total_slides) || 0)

    const totalSlidesRow = await sql`
      SELECT COUNT(*)::int AS count
      FROM lecture_slides
      WHERE lecture_id = ${lectureId}
    `
    const slideCountFromDb = Number(totalSlidesRow[0]?.count) || 0
    const totalSlideCount = Math.max(slideCountFromDb, totalSlidesParam, currentSlide)

    const previousProgress = await sql`
      SELECT status, completed_slides
      FROM lecture_student_progress
      WHERE lecture_id = ${lectureId} AND student_id = ${studentDbId}
    `
    const previousStatus = previousProgress[0]?.status as string | undefined
    const existingCompleted = parseSlideList(previousProgress[0]?.completed_slides)
    const mergedCompleted = [
      ...new Set([
        ...existingCompleted,
        ...incomingCompleted,
        ...(currentSlide > 0 ? [currentSlide] : []),
      ]),
    ].sort((a, b) => a - b)

    const completedCount = mergedCompleted.length
    const derivedPercentage = deriveProgressPercentage(totalSlideCount, completedCount, currentSlide)
    const derivedStatus = deriveStatus(
      totalSlideCount,
      completedCount,
      currentSlide,
      Number(time_spent_seconds) || 0,
      // An explicit un-complete has to ignore the sticky previous status.
      manualCompletion === false ? null : previousStatus,
    )
    const progressPercentage = manualCompletion === true ? 100 : derivedPercentage
    const status = manualCompletion === true ? "completed" : derivedStatus
    const wasJustCompleted = status === "completed" && previousStatus !== "completed"

    await withLectureProgressTriggersDisabled(async () => {
      await sql`
        INSERT INTO lecture_student_progress (
          lecture_id,
          student_id,
          last_viewed_slide_order,
          completed_slides,
          bookmarked_slides,
          confusion_flags,
          time_spent_seconds,
          notes,
          progress_percentage,
          status,
          last_accessed
        )
        VALUES (
          ${lectureId},
          ${studentDbId},
          ${currentSlide || 1},
          ${JSON.stringify(mergedCompleted)},
          ${bookmarked ? JSON.stringify([currentSlide]) : "[]"},
          ${confused ? JSON.stringify([currentSlide]) : "[]"},
          ${time_spent_seconds || 0},
          ${notes || null},
          ${progressPercentage},
          ${status},
          NOW()
        )
        ON CONFLICT (lecture_id, student_id)
        DO UPDATE SET
          last_viewed_slide_order = GREATEST(
            COALESCE(lecture_student_progress.last_viewed_slide_order, 0),
            EXCLUDED.last_viewed_slide_order
          ),
          completed_slides = EXCLUDED.completed_slides,
          bookmarked_slides = CASE
            WHEN ${Boolean(bookmarked)} THEN
              (SELECT COALESCE(jsonb_agg(DISTINCT elem), '[]'::jsonb)
               FROM (
                 SELECT jsonb_array_elements_text(lecture_student_progress.bookmarked_slides::jsonb) AS elem
                 UNION
                 SELECT ${String(currentSlide || 1)}::text
               ) t)
            ELSE lecture_student_progress.bookmarked_slides
          END,
          confusion_flags = CASE
            WHEN ${Boolean(confused)} THEN
              (SELECT COALESCE(jsonb_agg(DISTINCT elem), '[]'::jsonb)
               FROM (
                 SELECT jsonb_array_elements_text(lecture_student_progress.confusion_flags::jsonb) AS elem
                 UNION
                 SELECT ${String(currentSlide || 1)}::text
               ) t)
            ELSE lecture_student_progress.confusion_flags
          END,
          time_spent_seconds = lecture_student_progress.time_spent_seconds + ${time_spent_seconds || 0},
          notes = COALESCE(EXCLUDED.notes, lecture_student_progress.notes),
          progress_percentage = GREATEST(
            COALESCE(lecture_student_progress.progress_percentage, 0),
            EXCLUDED.progress_percentage
          ),
          status = CASE
            WHEN lecture_student_progress.status = 'completed' OR EXCLUDED.status = 'completed' THEN 'completed'
            WHEN lecture_student_progress.status = 'in_progress' OR EXCLUDED.status = 'in_progress' THEN 'in_progress'
            ELSE EXCLUDED.status
          END,
          last_accessed = NOW()
      `

      // The upsert above only ever ratchets progress upward, so clearing a manual
      // completion needs an explicit write.
      if (manualCompletion === false) {
        await sql`
          UPDATE lecture_student_progress
          SET status = ${status},
              progress_percentage = ${progressPercentage},
              last_accessed = NOW()
          WHERE lecture_id = ${lectureId} AND student_id = ${studentDbId}
        `
      }
    })

    try {
      const { syncActivityPointsAfterAction } = await import("@/lib/trade-center-sync")
      const student = await sql`
        SELECT section FROM students WHERE id = ${studentDbId}
      `
      const session = student[0]?.section || "ALL"
      await syncActivityPointsAfterAction(studentDbId, session, "lecture")

      if (wasJustCompleted) {
        try {
          const lectureData = await sql`SELECT title, week FROM lectures WHERE id = ${lectureId}`
          const reportData = {
            lecture_id: lectureId,
            lecture_title: lectureData[0]?.title || "Unknown",
            week: lectureData[0]?.week || 0,
            student_id: studentDbId,
            progress_percentage: progressPercentage,
            completed_slides: completedCount,
            total_slides: totalSlideCount,
            time_spent_seconds: time_spent_seconds || 0,
            completed_at: new Date().toISOString(),
            recommendations:
              progressPercentage >= 100
                ? ["Excellent! Lecture completed", "Review key concepts", "Take practice quiz"]
                : ["Continue reviewing slides", "Take notes", "Ask questions if confused"],
          }

          await sql`
            SELECT save_learning_report(
              ${studentDbId}::INTEGER,
              'lecture'::VARCHAR,
              ${lectureId}::INTEGER,
              ${JSON.stringify(reportData)}::JSONB
            )
          `
        } catch (reportError) {
          console.log("[Lecture Progress] Report generation failed (non-critical):", reportError)
        }
      }
    } catch (syncError) {
      console.error("[Lecture Progress] Trade Center sync failed (non-critical):", syncError)
    }

    return NextResponse.json({
      success: true,
      progress_percentage: progressPercentage,
      status,
      completed_slides: mergedCompleted,
      total_slides: totalSlideCount,
    })
  } catch (error) {
    console.error("[Lecture Progress] Error:", error)
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const lectureId = parseInt(id, 10)
    const auth = await requireStudentLectureCaller(
      request,
      request.nextUrl.searchParams.get("studentId"),
    )
    if (!auth.ok) return auth.response
    const studentDbId = auth.studentDbId

    const progress = await sql`
      SELECT * FROM lecture_student_progress
      WHERE lecture_id = ${lectureId}
      AND student_id = ${studentDbId}
    `

    if (progress.length === 0) {
      return NextResponse.json({
        progress: null,
        status: "not_started",
      })
    }

    return NextResponse.json({
      progress: progress[0],
      status: progress[0].status,
    })
  } catch (error) {
    console.error("[Lecture Progress] Error:", error)
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 })
  }
}
