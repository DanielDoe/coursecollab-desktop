import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { 
      studentId, 
      examDate, 
      availableHoursPerDay = 2,
      preferredTimes = []
    } = await request.json()

    const auth = await requireBoundStudentCaller(
      request,
      studentId != null && String(studentId).trim() ? String(studentId) : null,
    )
    if (!auth.ok) return auth.response

    if (!examDate) {
      return NextResponse.json(
        { success: false, error: "examDate is required" },
        { status: 400 }
      )
    }

    // Get student's weak topics from AI conversations
    const weakTopics = await sql`
      SELECT 
        topic,
        COUNT(*) as question_count
      FROM ai_tutor_conversations
      WHERE student_id = ${auth.studentDbId}
        AND topic IS NOT NULL
        AND topic != ''
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY topic
      ORDER BY question_count DESC
      LIMIT 10
    `
    
    // Also try to get mastery data if table exists
    let masteryTopics = []
    try {
      masteryTopics = await sql`
        SELECT topic, mastery_percentage
        FROM ai_tutor_topic_mastery
        WHERE student_id = ${auth.studentDbId}
          AND mastery_percentage < 70
        ORDER BY mastery_percentage ASC
        LIMIT 10
      `
    } catch (e) {
      console.log('[Study Plan] Topic mastery table not available yet, using question counts')
    }

    // Get existing calendar commitments
    const existingEvents = await sql`
      SELECT title, start_time, end_time
      FROM calendar_events
      WHERE student_id = ${auth.studentDbId}
        AND start_time BETWEEN NOW() AND ${examDate}
      ORDER BY start_time
    `

    // Calculate days until exam
    const daysUntil = Math.ceil(
      (new Date(examDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    )

    // AI generates personalized study plan
    const { content: studyPlanContent } = await createForFeature(openai, "summary", {

      messages: [{
        role: "system",
        content: `Create a personalized study schedule for a C++ programming exam.
        
        Days until exam: ${daysUntil}
        Available hours per day: ${availableHoursPerDay}
        Topics to focus on: ${weakTopics.map(t => t.topic).join(', ')}
        ${masteryTopics.length > 0 ? `Weak topics: ${masteryTopics.map(t => `${t.topic} (${t.mastery_percentage}% mastery)`).join(', ')}` : ''}
        Existing commitments: ${existingEvents.length}
        
        Generate a JSON study plan:
        {
          "overview": {
            "totalStudyHours": number,
            "sessionsPerDay": number,
            "focusTopics": ["topic1", "topic2"]
          },
          "dailySchedule": [
            {
              "date": "2025-11-10",
              "dayOfWeek": "Sunday",
              "sessions": [
                {
                  "startTime": "14:00",
                  "duration": 90,
                  "topic": "Pointers",
                  "activities": ["Review lecture notes", "Practice 10 problems", "Take practice quiz"],
                  "goals": "Achieve 80% mastery in pointers",
                  "resources": ["Week 3 lecture", "Practice problem set"]
                }
              ]
            }
          ],
          "milestones": [
            {
              "date": "2025-11-12",
              "goal": "Complete all practice problems",
              "checkIn": "Self-assessment quiz"
            }
          ]
        }`
      }],
      temperature: 0.6,
      max_tokens: 3000,
      response_format: { type: "json_object" }
    })

    const studyPlan = JSON.parse(studyPlanContent || "{}")

    // Save study plan
    const planId = await sql`
      INSERT INTO ai_study_plans (
        student_id,
        plan_type,
        target_date,
        plan_data,
        is_active,
        expires_at
      ) VALUES (
        ${auth.studentDbId},
        'exam_prep',
        ${examDate},
        ${JSON.stringify(studyPlan)},
        true,
        ${examDate}
      )
      RETURNING id
    `

    // Create calendar events for all study sessions
    let eventsCreated = 0

    for (const day of studyPlan.dailySchedule || []) {
      for (const session of day.sessions || []) {
        const startTimeStr = `${day.date} ${session.startTime}`
        const durationMinutes = Math.max(1, Math.round(Number(session.duration) || 60))
        const activities = Array.isArray(session.activities) ? session.activities.join(" • ") : ""

        await sql`
          INSERT INTO calendar_events (
            student_id,
            title,
            description,
            event_type,
            start_time,
            end_time,
            color,
            reminder_minutes,
            related_id,
            related_type
          ) VALUES (
            ${auth.studentDbId},
            ${"Study: " + session.topic},
            ${activities},
            'study_session',
            ${startTimeStr}::timestamp,
            ${startTimeStr}::timestamp + (${durationMinutes} * INTERVAL '1 minute'),
            '#8b5cf6',
            30,
            ${planId[0].id},
            'study_plan'
          )
        `
        eventsCreated++
      }
    }

    return NextResponse.json({
      success: true,
      plan: studyPlan,
      planId: planId[0].id,
      eventsCreated,
      message: `Study plan created with ${eventsCreated} sessions added to your calendar!`
    })

  } catch (error: any) {
    console.error("[Study Plan Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate study plan", details: error.message },
      { status: 500 }
    )
  }
}

