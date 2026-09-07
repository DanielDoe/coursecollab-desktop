import { chatCompletionWithFallback } from "@/lib/openai-with-fallback"
import { resolveModelForFeature } from "@/lib/resolve-feature-ai-model"
import { buildGradeContextForAi } from "./adjust-gradebook-for-review"
import type { GeneratedProgressReview, ProgressReviewSections, StudentProgressData } from "./types"
import { formatAsOfLabel, getReviewPeriodConfig } from "./review-period"

function firstName(full: string): string {
  const s = String(full ?? "").trim()
  if (!s) return "Student"
  return s.split(/\s+/)[0] ?? "Student"
}

function safeJsonParse(raw: string): Partial<ProgressReviewSections> {
  const trimmed = raw.trim()
  let text = trimmed
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) text = fence[1].trim()
  try {
    return JSON.parse(text) as Partial<ProgressReviewSections>
  } catch {
    return {}
  }
}

function normalizeSections(
  parsed: Partial<ProgressReviewSections>,
  data: StudentProgressData,
): ProgressReviewSections {
  const periodCfg = getReviewPeriodConfig(data.reviewPeriod)
  const fn = firstName(data.student.fullName)
  const gb = data.gradebook
  const total = gb?.totalScore ?? 0
  const asOfNote =
    data.reviewPeriod === "custom" && data.asOfDate
      ? ` through ${formatAsOfLabel(data.asOfDate) ?? data.asOfDate}`
      : ""

  const defaultSummary = gb?.gradeIsProvisional
    ? `${fn}, here is your ${periodCfg.label.toLowerCase()} progress snapshot${asOfNote}. Based on graded work so far, you are at ${total.toFixed(1)}% — this is not your final course grade because ${gb.pendingCategories.join(", ") || "some categories"} have not been scored yet. This review covers your assessments, practice work, classroom participation, and attendance.`
    : `${fn}, here is your ${periodCfg.label.toLowerCase()} progress snapshot${asOfNote}. Your overall grade is ${total.toFixed(1)}%${gb?.letterGrade ? ` (${gb.letterGrade})` : ""}. This review covers your assessments, practice work, classroom participation, and attendance.`

  return {
    overallSummary:
      String(parsed.overallSummary ?? "").trim() || defaultSummary,
    strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0
      ? parsed.strengths.map(String).slice(0, 5)
      : buildRuleBasedStrengths(data),
    areasToImprove: Array.isArray(parsed.areasToImprove) && parsed.areasToImprove.length > 0
      ? parsed.areasToImprove.map(String).slice(0, 5)
      : buildRuleBasedImprovements(data),
    assessmentFeedback:
      String(parsed.assessmentFeedback ?? "").trim() || buildAssessmentFeedback(data),
    practiceFeedback:
      String(parsed.practiceFeedback ?? "").trim() || buildPracticeFeedback(data),
    attendanceFeedback:
      String(parsed.attendanceFeedback ?? "").trim() || buildAttendanceFeedback(data),
    classroomFeedback:
      String(parsed.classroomFeedback ?? "").trim() || buildClassroomFeedback(data),
    actionPlan: Array.isArray(parsed.actionPlan) && parsed.actionPlan.length > 0
      ? parsed.actionPlan.map(String).slice(0, 6)
      : buildActionPlan(data),
    encouragement:
      String(parsed.encouragement ?? "").trim() ||
      `Keep building on your strengths, ${fn}. The second half of the term is your chance to turn targeted practice into higher scores — your instructor is here to support you.`,
  }
}

function buildRuleBasedStrengths(data: StudentProgressData): string[] {
  const out: string[] = []
  if ((data.gradebook?.quizScore ?? 0) >= 80) out.push("Strong quiz performance relative to the class average.")
  if ((data.gradebook?.homeworkScore ?? 0) >= 80) out.push("Consistent homework completion and quality.")
  if (data.practiceHub.totalAttempts >= 5) out.push("Active use of the Practice Hub — great habit for exam prep.")
  if (data.practiceHub.strongTopics.length > 0) {
    out.push(`Solid understanding in: ${data.practiceHub.strongTopics.slice(0, 3).join(", ")}.`)
  }
  if (data.attendance.attendanceRate >= 85) out.push("Excellent attendance — you are showing up consistently.")
  if ((data.gradebook?.classroomScore ?? 0) >= 75) out.push("Good classroom participation and engagement.")
  if (out.length === 0) out.push("You have completed work across multiple areas — that foundation matters.")
  return out.slice(0, 5)
}

function buildRuleBasedImprovements(data: StudentProgressData): string[] {
  const out: string[] = []
  if ((data.gradebook?.quizScore ?? 0) < 70 && data.assessments.length > 0) {
    out.push("Quiz scores have room to grow — review incorrect questions and instructor feedback after each attempt.")
  }
  if ((data.gradebook?.homeworkScore ?? 0) < 70) {
    out.push("Homework accuracy needs attention — start assignments earlier and use office hours for stuck problems.")
  }
  if (data.practiceHub.weakTopics.length > 0) {
    out.push(`Focus extra practice on: ${data.practiceHub.weakTopics.slice(0, 3).join(", ")}.`)
  }
  if (data.practiceHub.totalAttempts < 3) {
    out.push("Increase Practice Hub usage — even 15 minutes per week on weak topics helps before exams.")
  }
  if (data.attendance.attendanceRate < 80 && data.attendance.totalSessions > 0) {
    out.push("Attendance is below target — missing class makes the next exam harder to prepare for.")
  }
  if (data.lecturePractice.totalAttempts < 5) {
    out.push("Complete more lecture sample practice questions while reviewing each week's slides.")
  }
  if (out.length === 0) out.push("Maintain consistency — small weekly improvements compound before the final.")
  return out.slice(0, 5)
}

function buildAssessmentFeedback(data: StudentProgressData): string {
  if (data.assessments.length === 0) {
    return "No completed assessments recorded yet. Prioritize upcoming quizzes and homework so your gradebook reflects your ability."
  }
  const recent = data.assessments.slice(0, 5)
  const lines = recent.map(
    (a) =>
      `${a.title} (${a.assessmentType}): ${a.percentage.toFixed(1)}%` +
      (a.incorrectTopics.length ? ` — revisit: ${a.incorrectTopics.slice(0, 2).join(", ")}` : ""),
  )
  const fb = data.assessments
    .flatMap((a) => a.feedbackHighlights)
    .slice(0, 2)
    .map((f) => `Instructor/AI note: ${f}`)
  return [...lines, ...fb].join(" ")
}

function buildPracticeFeedback(data: StudentProgressData): string {
  const ph = data.practiceHub
  const lp = data.lecturePractice
  const parts: string[] = []
  if (ph.totalAttempts > 0) {
    parts.push(
      `Practice Hub: ${ph.totalAttempts} session(s), average ${ph.avgScore.toFixed(1)}%, accuracy ${ph.accuracy.toFixed(1)}%.`,
    )
    if (ph.weakTopics.length) parts.push(`Weakest topics: ${ph.weakTopics.join(", ")}.`)
  } else {
    parts.push("Practice Hub: no completed sessions yet — start with topics from recent lectures.")
  }
  if (lp.totalAttempts > 0) {
    parts.push(`Lecture sample practice: ${lp.correctCount}/${lp.totalAttempts} correct (${lp.accuracy.toFixed(1)}%).`)
  }
  return parts.join(" ")
}

function buildAttendanceFeedback(data: StudentProgressData): string {
  const a = data.attendance
  if (a.totalSessions === 0) {
    return "No attendance has been scored yet for this term."
  }
  let msg = `You earned credit for ${a.presentCount} of ${a.totalSessions} scored class sessions (${a.attendanceRate.toFixed(1)}% so far).`
  if (a.scheduledSessionsTotal > a.totalSessions) {
    msg += ` ${a.scheduledSessionsTotal - a.totalSessions} future session${a.scheduledSessionsTotal - a.totalSessions === 1 ? "" : "s"} are not counted yet.`
  }
  if (a.gradebookScore != null) msg += ` Attendance grade contribution: ${a.gradebookScore.toFixed(1)}%.`
  if (a.recentMissed.length) msg += ` Recent absences: ${a.recentMissed.join("; ")}.`
  return msg
}

function buildClassroomFeedback(data: StudentProgressData): string {
  const approved = data.classroomPoints.filter(
    (p) => !p.status || p.status === "approved",
  )
  if (approved.length === 0) {
    return "No classroom points recorded yet — participate in in-class activities and CodeBench submissions."
  }
  const total = approved.reduce((s, p) => s + p.points, 0)
  const recent = approved
    .slice(0, 3)
    .map((p) => `${p.points} pt${p.points === 1 ? "" : "s"}${p.reason ? `: ${p.reason}` : ""}`)
  return `Classroom points total: ${total.toFixed(2)}. Recent: ${recent.join("; ")}.`
}

function buildActionPlan(data: StudentProgressData): string[] {
  const plan: string[] = []
  if (data.practiceHub.weakTopics.length) {
    plan.push(`This week: 2 Practice Hub sessions on ${data.practiceHub.weakTopics[0]}.`)
  }
  if (data.assessments.some((a) => a.percentage < 75)) {
    plan.push("Re-read feedback on your lowest-scoring assessment and redo missed questions without notes.")
  }
  plan.push("Review lecture slides and complete sample practice before the next class.")
  if (data.attendance.attendanceRate < 90) {
    plan.push("Aim for perfect attendance for the remainder of the term.")
  }
  plan.push("Use office hours or the forum if a concept stays unclear after two study attempts.")
  return plan.slice(0, 6)
}

function buildDataSummaryForAi(data: StudentProgressData): string {
  const assessmentLines = (data.assessments ?? []).slice(0, 12).map((a) => {
    const fb = (a.feedbackHighlights ?? []).slice(0, 2).join(" | ")
    return `- ${a.title} (${a.assessmentType}): ${a.percentage}%${a.incorrectTopics?.length ? `; weak topics: ${a.incorrectTopics.join(", ")}` : ""}${fb ? `; feedback: ${fb}` : ""}`
  })

  const cpLines = (data.classroomPoints ?? []).slice(0, 10).map(
    (p) => `- ${p.points} pts${p.category ? ` [${p.category}]` : ""}${p.reason ? `: ${p.reason}` : ""} (${p.status ?? "approved"})`,
  )

  const lecturePractice = data.lecturePractice ?? { correctCount: 0, totalAttempts: 0, accuracy: 0 }

  return `
Student: ${data.student.fullName} (${data.student.section ?? "section unknown"})
Course: ${data.courseCode ?? "N/A"}
Instructor: ${data.instructorName ?? "Instructor"}

${buildGradeContextForAi(data.gradebook)}

Assessments (${(data.assessments ?? []).length} completed):
${assessmentLines.join("\n") || "(none)"}

Practice Hub: ${data.practiceHub.totalAttempts} sessions, avg ${data.practiceHub.avgScore}%, accuracy ${data.practiceHub.accuracy}%
Strong topics: ${data.practiceHub.strongTopics.join(", ") || "—"}
Weak topics: ${data.practiceHub.weakTopics.join(", ") || "—"}

Lecture sample practice: ${lecturePractice.correctCount}/${lecturePractice.totalAttempts} correct (${lecturePractice.accuracy}%)

Attendance: ${data.attendance.presentCount}/${data.attendance.totalSessions} scored sessions (${data.attendance.attendanceRate}% so far${data.attendance.scheduledSessionsTotal > data.attendance.totalSessions ? `; ${data.attendance.scheduledSessionsTotal} scheduled for term` : ""})

Classroom points:
${cpLines.join("\n") || "(none)"}
`.trim()
}

export async function generateProgressReview(
  data: StudentProgressData,
): Promise<GeneratedProgressReview> {
  const apiKey = process.env.OPENAI_API_KEY
  const fn = firstName(data.student.fullName)

  if (!apiKey) {
    return {
      sections: normalizeSections({}, data),
      modelUsed: "rule-based-fallback",
      generatedAt: new Date().toISOString(),
    }
  }

  const system = `You are an experienced, supportive engineering instructor writing a personalized progress review for one student.
${getReviewPeriodConfig(data.reviewPeriod).aiFocus}
${data.reviewPeriod === "custom" && data.asOfDate ? `Data snapshot as of: ${formatAsOfLabel(data.asOfDate) ?? data.asOfDate}. Do not reference activity after this date.` : ""}
Tone: constructive, specific, encouraging — never harsh or dismissive. Address the student by first name.
Use ONLY facts from the data provided. Do not invent scores, assignments, or feedback.
When scores are strong, celebrate specifically. When weak, give actionable advice tied to their actual data.
If gradeIsProvisional or pending categories exist, NEVER describe the student as failing or cite an F letter grade — major exams may not have scores yet.
Reference instructor/AI feedback themes when present. Keep each section concise (2-4 sentences unless a list).
Return JSON ONLY with keys:
{
  "overallSummary": string,
  "strengths": string[],
  "areasToImprove": string[],
  "assessmentFeedback": string,
  "practiceFeedback": string,
  "attendanceFeedback": string,
  "classroomFeedback": string,
  "actionPlan": string[],
  "encouragement": string
}`

  const user = `Write a personalized ${getReviewPeriodConfig(data.reviewPeriod).label.toLowerCase()} progress review for ${fn}.

${buildDataSummaryForAi(data)}`

  try {
    const result = await chatCompletionWithFallback(apiKey, {
      model: resolveModelForFeature("progress_review"),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.65,
      max_tokens: 2200,
      response_format: { type: "json_object" },
    })

    const parsed = safeJsonParse(result.content)
    return {
      sections: normalizeSections(parsed, data),
      modelUsed: result.modelUsed,
      generatedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.warn("[progress-review] AI generation failed, using rule-based:", err)
    return {
      sections: normalizeSections({}, data),
      modelUsed: "rule-based-fallback",
      generatedAt: new Date().toISOString(),
    }
  }
}

export function reviewToMarkdown(
  sections: ProgressReviewSections,
  data: StudentProgressData,
): string {
  const fn = firstName(data.student.fullName)
  const periodLabel = getReviewPeriodConfig(data.reviewPeriod).label
  const asOf =
    data.reviewPeriod === "custom" && data.asOfDate
      ? ` (as of ${formatAsOfLabel(data.asOfDate) ?? data.asOfDate})`
      : ""
  const lines: string[] = [
    `# ${periodLabel} Progress Review — ${fn}${asOf}`,
    "",
    sections.overallSummary,
    "",
    "## Strengths",
    ...sections.strengths.map((s) => `- ${s}`),
    "",
    "## Areas to Improve",
    ...sections.areasToImprove.map((s) => `- ${s}`),
    "",
    "## Assessments",
    sections.assessmentFeedback,
    "",
    "## Practice Hub & Lecture Practice",
    sections.practiceFeedback,
    "",
    "## Attendance",
    sections.attendanceFeedback,
    "",
    "## Classroom Participation",
    sections.classroomFeedback,
    "",
    "## Your Action Plan",
    ...sections.actionPlan.map((s) => `- ${s}`),
    "",
    "## Closing Note",
    sections.encouragement,
  ]
  return lines.join("\n")
}
