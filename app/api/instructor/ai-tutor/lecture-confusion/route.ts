import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const instructorId = request.headers.get("x-instructor-id")
    
    if (!instructorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get AI questions grouped by slide
    const slideConfusion = await sql`
      WITH slide_questions AS (
        SELECT 
          ls.id as slide_id,
          ls.lecture_id,
          ls.title as slide_title,
          ls.slide_order,
          l.title as lecture_title,
          l.week,
          aic.id as question_id,
          aic.student_id,
          aic.message,
          aic.created_at,
          s.full_name as student_name
        FROM lecture_slides ls
        JOIN lectures l ON ls.lecture_id = l.id
        LEFT JOIN ai_tutor_conversations aic ON 
          aic.context->>'slideId' = ls.id::text
          AND aic.created_at >= NOW() - INTERVAL '30 days'
        LEFT JOIN students s ON aic.student_id = s.id
        WHERE ls.is_active = true
      )
      SELECT 
        slide_id,
        lecture_id,
        lecture_title,
        week,
        slide_title,
        slide_order,
        COUNT(DISTINCT question_id) FILTER (WHERE question_id IS NOT NULL) as question_count,
        COUNT(DISTINCT student_id) FILTER (WHERE student_id IS NOT NULL) as student_count,
        CASE 
          WHEN COUNT(DISTINCT question_id) >= 10 THEN 'critical'
          WHEN COUNT(DISTINCT question_id) >= 6 THEN 'high'
          WHEN COUNT(DISTINCT question_id) >= 3 THEN 'medium'
          ELSE 'low'
        END as confusion_level,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', question_id,
            'student_name', student_name,
            'message', message,
            'timestamp', created_at
          ) ORDER BY created_at DESC
        ) FILTER (WHERE question_id IS NOT NULL) as questions
      FROM slide_questions
      GROUP BY slide_id, lecture_id, lecture_title, week, slide_title, slide_order
      HAVING COUNT(DISTINCT question_id) FILTER (WHERE question_id IS NOT NULL) > 0
      ORDER BY question_count DESC, week ASC, slide_order ASC
      LIMIT 100
    `

    const formattedSlides = slideConfusion.map(slide => ({
      ...slide,
      question_count: Number(slide.question_count),
      student_count: Number(slide.student_count),
      questions: (slide.questions || []).map((q: any) => ({
        ...q,
        timestamp: new Date(q.timestamp).toLocaleString()
      }))
    }))

    return NextResponse.json({ slides: formattedSlides })
  } catch (error) {
    console.error("[Lecture Confusion] Error:", error)
    return NextResponse.json({ slides: [] })
  }
}

