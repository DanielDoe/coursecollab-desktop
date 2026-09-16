import { sql } from "@/lib/db"
import { createNotification } from "@/lib/create-notification"
import { sendInstructorDirectMessage } from "@/lib/cora/services/send-instructor-message"
import { chatCompletionWithFallback } from "@/lib/openai-with-fallback"
import { resolveModelForFeature } from "@/lib/resolve-feature-ai-model"
import { ensureStudentProgressReviewsSchema } from "@/lib/ensure-student-progress-reviews-schema"
import { loadStudentProfile } from "@/lib/cora/insights/query"
import type { FacultyInsightsScope } from "@/lib/cora/insights/scope"
import type { ProgressReviewSections } from "@/lib/midterm-progress-review/types"

type PracticePlan = {
  title: string
  summary: string
  topics: string[]
  tasks: string[]
  encouragement: string
  modelUsed: string
}

function firstName(full: string) {
  const s = String(full ?? "").trim()
  return s.split(/\s+/)[0] || "Student"
}

function parsePlan(raw: string, fallback: PracticePlan): PracticePlan {
  try {
    const text = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "")
    const parsed = JSON.parse(text) as Partial<PracticePlan>
    const topics = Array.isArray(parsed.topics) ? parsed.topics.map(String).filter(Boolean).slice(0, 5) : []
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks.map(String).filter(Boolean).slice(0, 6) : []
    return {
      title: String(parsed.title ?? fallback.title).trim() || fallback.title,
      summary: String(parsed.summary ?? fallback.summary).trim() || fallback.summary,
      topics: topics.length ? topics : fallback.topics,
      tasks: tasks.length ? tasks : fallback.tasks,
      encouragement: String(parsed.encouragement ?? fallback.encouragement).trim() || fallback.encouragement,
      modelUsed: fallback.modelUsed,
    }
  } catch {
    return fallback
  }
}

function fallbackPlan(name: string, concepts: string[], concern: string): PracticePlan {
  const topics = concepts.slice(0, 4)
  const focus = topics[0] || "recent course topics"
  return {
    title: "Targeted practice from Cora",
    summary: `${firstName(name)}, your instructor assigned a short practice plan based on your recent Cora work${concern ? ` — ${concern}` : ""}.`,
    topics: topics.length ? topics : [focus],
    tasks: [
      `Review ${focus} and rewrite the key idea in your own words.`,
      `Complete 3–5 practice items on ${focus} without asking Cora for the answer.`,
      topics[1] ? `Then try one mixed problem that also uses ${topics[1]}.` : "Retry one similar problem independently after a short break.",
    ],
    encouragement: "Use Cora for hints if you get stuck, then finish the item on your own.",
    modelUsed: "rule-based-fallback",
  }
}

function planToSections(plan: PracticePlan): ProgressReviewSections {
  return {
    overallSummary: plan.summary,
    strengths: [],
    areasToImprove: plan.topics,
    assessmentFeedback: "",
    practiceFeedback: [plan.title, ...plan.tasks].join("\n"),
    attendanceFeedback: "",
    classroomFeedback: "",
    actionPlan: plan.tasks,
    encouragement: plan.encouragement,
  }
}

function planToMarkdown(plan: PracticePlan) {
  return [
    `# ${plan.title}`,
    "",
    plan.summary,
    "",
    "## Focus topics",
    ...plan.topics.map((t) => `- ${t}`),
    "",
    "## Practice plan",
    ...plan.tasks.map((t, i) => `${i + 1}. ${t}`),
    "",
    plan.encouragement,
  ].join("\n")
}

function planToMessageHtml(plan: PracticePlan, studentName: string) {
  const fn = firstName(studentName)
  return [
    `<p>Hi ${fn},</p>`,
    `<p>${plan.summary}</p>`,
    `<p><strong>Focus:</strong> ${plan.topics.join(", ")}</p>`,
    `<p><strong>What to do next</strong></p>`,
    `<ol>${plan.tasks.map((t) => `<li>${t}</li>`).join("")}</ol>`,
    `<p>${plan.encouragement}</p>`,
    `<p>A copy is also in your Progress Review.</p>`,
  ].join("")
}

async function generatePlan(input: {
  studentName: string
  courseCode: string
  concern: string
  evidence: string
  concepts: Array<{ concept: string; requests: number }>
}): Promise<PracticePlan> {
  const fallback = fallbackPlan(
    input.studentName,
    input.concepts.map((c) => c.concept),
    input.concern,
  )
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return fallback

  const conceptLines = input.concepts
    .map((c) => `- ${c.concept} (${c.requests} Cora requests)`)
    .join("\n") || "- No labeled topics yet"

  try {
    const result = await chatCompletionWithFallback(apiKey, {
      model: resolveModelForFeature("insights"),
      messages: [
        {
          role: "system",
          content:
            "You are Cora, an instructional assistant. Write a concise targeted practice assignment for one college student. Use only the supplied facts. Do not invent scores. Return JSON only.",
        },
        {
          role: "user",
          content: `Student: ${input.studentName}
Course: ${input.courseCode}
Instructor concern: ${input.concern || "None stated"}
Evidence: ${input.evidence || "Cora usage in the selected window"}
Cora topics:
${conceptLines}

Return JSON:
{
  "title": string,
  "summary": string (2 sentences, address the student by first name),
  "topics": string[] (2-4 focus topics),
  "tasks": string[] (3-5 concrete practice steps),
  "encouragement": string
}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 800,
      response_format: { type: "json_object" },
    })
    return parsePlan(result.content ?? "", { ...fallback, modelUsed: result.modelUsed })
  } catch (err) {
    console.warn("[cora-insights] targeted practice generation failed", err)
    return fallback
  }
}

export async function assignTargetedPractice(scope: FacultyInsightsScope, studentId: number) {
  if (!scope.rosterIds.includes(studentId)) {
    throw new Error("Student not in course scope")
  }

  const profile = await loadStudentProfile(scope, studentId)
  if (profile.empty || !profile.student) {
    throw new Error("Not enough student data to assign practice")
  }

  const student = profile.student
  const concepts = (profile.concepts ?? []).map((c) => ({
    concept: String(c.concept),
    requests: Number(c.requests) || 0,
  }))
  const plan = await generatePlan({
    studentName: String(student.name),
    courseCode: scope.courseCode,
    concern: String(student.primaryConcern ?? ""),
    evidence: String(student.evidence ?? ""),
    concepts,
  })
  const sections = planToSections(plan)
  const markdown = planToMarkdown(plan)
  const asOfDate = new Date().toISOString().slice(0, 10)

  await ensureStudentProgressReviewsSchema()
  const saved = (await sql`
    INSERT INTO student_progress_reviews (
      student_id, course_id, instructor_id, review_period, as_of_date,
      progress_data, review_sections, content_markdown, model_used
    ) VALUES (
      ${studentId},
      ${scope.courseId},
      ${scope.instructorId},
      ${"targeted_practice"},
      ${asOfDate},
      ${JSON.stringify({
        kind: "targeted_practice",
        courseCode: scope.courseCode,
        student: { fullName: student.name, code: student.code },
        topics: plan.topics,
        coraSessions: student.coraSessions,
      })}::jsonb,
      ${JSON.stringify(sections)}::jsonb,
      ${markdown},
      ${plan.modelUsed}
    )
    RETURNING id
  `) as Array<{ id: number }>
  const reviewId = Number(saved[0]?.id ?? 0)

  const message = await sendInstructorDirectMessage({
    instructorId: scope.instructorId,
    courseId: scope.courseId,
    recipientStudentId: studentId,
    subject: `Targeted practice — ${scope.courseCode}`,
    body: planToMessageHtml(plan, String(student.name)),
  })

  const notification = await createNotification({
    studentId,
    type: "progress_review",
    title: "Targeted practice assigned",
    message: `${plan.title}: ${plan.topics.slice(0, 2).join(", ") || "new practice from your instructor"}.`,
    link: "/student/dashboard-v2/progress-review",
  })

  return {
    reviewId,
    threadId: message.threadId,
    messageId: message.messageId,
    notificationId: notification?.id ?? null,
    plan,
  }
}
