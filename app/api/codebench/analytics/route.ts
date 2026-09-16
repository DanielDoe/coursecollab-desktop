import { NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { getStudentCodeBenchEntitlement } from "@/lib/codebench-entitlement"
import { sql } from "@/lib/db"
import { codebenchUsageContext, isInsufficientCoraCredits, jsonFromCodebenchCoraError } from "@/lib/codebench-cora-usage"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"

type SubmissionRow = {
  id: number
  score: number | null
  points_awarded: number | null
  status: string | null
  submitted_at: string | Date
  code?: string | null
  title?: string | null
  source: "codebench" | "practice" | "challenge"
}

function shortDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function computeStreakDays(rows: SubmissionRow[]) {
  const activityMap = new Set<string>()
  for (const r of rows) {
    const d = new Date(r.submitted_at)
    if (Number.isNaN(d.getTime())) continue
    activityMap.add(d.toISOString().split("T")[0]!)
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let streak = 0
  for (let i = 0; i < 60; i++) {
    const check = new Date(today)
    check.setDate(check.getDate() - i)
    const key = check.toISOString().split("T")[0]!
    if (activityMap.has(key)) {
      streak++
    } else if (i === 0) {
      continue
    } else {
      break
    }
  }
  return streak
}

function buildPerformance(rows: SubmissionRow[], streakDays: number) {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime(),
  )
  const withScores = sorted.filter((r) => typeof r.score === "number")
  const avgScore =
    withScores.length > 0
      ? Math.round(withScores.reduce((sum, r) => sum + (r.score ?? 0), 0) / withScores.length)
      : 0
  const approvedCount = sorted.filter((r) => (r.status || "").toLowerCase() === "approved").length
  const xpEarned = sorted.reduce((sum, r) => sum + (r.points_awarded ?? 0), 0)

  const scoreTrend = withScores.slice(-12).map((r) => {
    const d = new Date(r.submitted_at)
    return {
      date: shortDate(d),
      score: Math.max(0, Math.min(100, Number(r.score) || 0)),
      source: r.source,
    }
  })

  const activityBuckets = [0, 0, 0, 0, 0, 0, 0]
  const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000
  for (const r of sorted) {
    const d = new Date(r.submitted_at)
    if (d.getTime() < cutoff) continue
    activityBuckets[d.getDay()] = (activityBuckets[d.getDay()] ?? 0) + 1
  }
  const activityByDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => ({
    day,
    count: activityBuckets[i] ?? 0,
  }))

  const statusCounts = new Map<string, number>()
  for (const r of sorted) {
    const key = (r.status || "pending").toLowerCase()
    statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1)
  }
  const statusMix = [...statusCounts.entries()].map(([name, value]) => ({ name, value }))

  const sourceCounts = {
    codebench: sorted.filter((r) => r.source === "codebench").length,
    practice: sorted.filter((r) => r.source === "practice").length,
    challenge: sorted.filter((r) => r.source === "challenge").length,
  }

  const recent = [...sorted]
    .reverse()
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      source: r.source,
      score: r.score,
      status: r.status,
      points: r.points_awarded,
      submittedAt: r.submitted_at,
      title: r.title || (r.source === "challenge" ? "Daily challenge" : r.source === "practice" ? "Practice problem" : "CodeBench submit"),
    }))

  return {
    submissionCount: sorted.length,
    avgScore,
    approvedCount,
    xpEarned,
    streakDays,
    scoreTrend,
    activityByDay,
    statusMix,
    sourceCounts,
    recent,
  }
}

const DEFAULT_CORA = {
  overview:
    "Cora is still gathering enough CodeBench activity to personalize a deep read. Keep submitting solutions and she will refine this breakdown.",
  concepts: {
    loops: 40,
    pointers: 35,
    oop: 30,
    recursion: 25,
    arrays: 45,
    stl: 30,
  },
  strengths: [] as string[],
  weaknesses: [] as string[],
  proficiencyScore: 40,
  level: "Beginner",
  detailedBreakdown: [
    {
      title: "Getting started",
      detail: "Submit CodeBench work, practice problems, or daily challenges so Cora can observe score trends and concept patterns.",
      severity: "info" as const,
    },
  ],
  recommendations: [
    "Complete today's daily challenge",
    "Submit at least one evaluated solution this week",
    "Ask Cora to walk through a concept you find confusing",
  ],
  weekly_plan: "Focus on consistent practice: one evaluated submission and one challenge attempt this week.",
  tasks: [
    "Open the editor and complete one warm-up problem",
    "Submit code for evaluation feedback",
    "Retry a weak concept with Cora tools",
  ],
  study_time_minutes: 90,
}

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    const bound = await requireCodebenchStudent(request, studentId)
    if (!bound.ok) return bound.response

    const id = bound.studentDbId

    const [codeSubs, practiceSubs, challengeSubs] = await Promise.all([
      sql`
        SELECT id, code, score, points_awarded, status, submitted_at
        FROM codebench_submissions
        WHERE student_id = ${id}
        ORDER BY submitted_at DESC
        LIMIT 40
      `,
      sql`
        SELECT id, problem as title, code, score, points_awarded, status, submitted_at
        FROM practice_submissions
        WHERE student_id = ${id}
        ORDER BY submitted_at DESC
        LIMIT 40
      `,
      sql`
        SELECT id, challenge_title as title, code as solution, score, points_awarded, status, submitted_at
        FROM daily_challenge_submissions
        WHERE student_id = ${id}
        ORDER BY submitted_at DESC
        LIMIT 40
      `,
    ])

    const rows: SubmissionRow[] = [
      ...(codeSubs as any[]).map((r) => ({
        id: r.id,
        score: r.score,
        points_awarded: r.points_awarded,
        status: r.status,
        submitted_at: r.submitted_at,
        code: r.code,
        title: null,
        source: "codebench" as const,
      })),
      ...(practiceSubs as any[]).map((r) => ({
        id: r.id,
        score: r.score,
        points_awarded: r.points_awarded,
        status: r.status,
        submitted_at: r.submitted_at,
        code: r.code,
        title: typeof r.title === "string" ? r.title.slice(0, 80) : null,
        source: "practice" as const,
      })),
      ...(challengeSubs as any[]).map((r) => ({
        id: r.id,
        score: r.score,
        points_awarded: r.points_awarded,
        status: r.status,
        submitted_at: r.submitted_at,
        code: r.solution ?? r.code,
        title: r.title ?? "Daily challenge",
        source: "challenge" as const,
      })),
    ]

    const streakDays = computeStreakDays(rows)
    const performance = buildPerformance(rows, streakDays)

    const latestCode = rows
      .map((r) => (r.code || "").trim())
      .find((c) => c.length > 40)

    const sampleSnippets = rows
      .filter((r) => (r.code || "").trim().length > 40)
      .slice(0, 3)
      .map((r, i) => `--- Sample ${i + 1} (${r.source}, score=${r.score ?? "n/a"}) ---\n${(r.code || "").slice(0, 1200)}`)
      .join("\n\n")

    let cora = { ...DEFAULT_CORA }

    const openaiApiKey = process.env.OPENAI_API_KEY
    const coraEntitlement = await getStudentCodeBenchEntitlement(id)
    if (coraEntitlement.coraAccess && openaiApiKey && (performance.submissionCount > 0 || latestCode)) {
      try {
        const openai = new OpenAI({ apiKey: openaiApiKey })
        const prompt = `You are Cora, CourseCollab's AI coding coach. Observe this student's CodeBench performance and produce a detailed analytics JSON report.

PERFORMANCE SUMMARY (observed from submissions):
${JSON.stringify(
  {
    submissionCount: performance.submissionCount,
    avgScore: performance.avgScore,
    approvedCount: performance.approvedCount,
    xpEarned: performance.xpEarned,
    streakDays: performance.streakDays,
    sourceCounts: performance.sourceCounts,
    recentScores: performance.scoreTrend,
    statusMix: performance.statusMix,
    recentTitles: performance.recent.map((r) => ({
      title: r.title,
      score: r.score,
      status: r.status,
      source: r.source,
    })),
  },
  null,
  2,
)}

RECENT CODE SAMPLES:
${sampleSnippets || latestCode?.slice(0, 2000) || "(no code yet)"}

Return ONLY JSON:
{
  "overview": "2-4 sentence coaching summary of how they are performing",
  "concepts": {
    "loops": 0-100,
    "pointers": 0-100,
    "oop": 0-100,
    "recursion": 0-100,
    "arrays": 0-100,
    "stl": 0-100
  },
  "strengths": ["..."],
  "weaknesses": ["..."],
  "proficiencyScore": 0-100,
  "level": "Beginner" | "Intermediate" | "Advanced",
  "detailedBreakdown": [
    { "title": "short label", "detail": "1-2 sentence insight", "severity": "strength" | "focus" | "info" }
  ],
  "recommendations": ["actionable next step", "..."],
  "weekly_plan": "paragraph",
  "tasks": ["task1", "task2", "task3", "task4"],
  "study_time_minutes": number
}

Rules:
- Ground claims in the observed scores/activity when possible.
- detailedBreakdown should have 4-6 items covering score trend, consistency, concept gaps, and next focus.
- Do not invent specific bugs that are not supported by the samples.
- Be specific and educational; never dump full solutions.`

        const { content } = await createForFeature(openai, "insights", {
          usageContext: codebenchUsageContext(id, "ANALYTICS", "codebench-analytics"),
          messages: [
            {
              role: "system",
              content:
                "You are Cora, an expert programming coach. Analyze student CodeBench performance and return valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.55,
          response_format: { type: "json_object" },
        })

        if (content) {
          const parsed = JSON.parse(content)
          cora = {
            overview: parsed.overview || DEFAULT_CORA.overview,
            concepts: { ...DEFAULT_CORA.concepts, ...(parsed.concepts || {}) },
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
            weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
            proficiencyScore:
              typeof parsed.proficiencyScore === "number"
                ? parsed.proficiencyScore
                : performance.avgScore || DEFAULT_CORA.proficiencyScore,
            level: parsed.level || DEFAULT_CORA.level,
            detailedBreakdown: Array.isArray(parsed.detailedBreakdown)
              ? parsed.detailedBreakdown
              : DEFAULT_CORA.detailedBreakdown,
            recommendations: Array.isArray(parsed.recommendations)
              ? parsed.recommendations
              : DEFAULT_CORA.recommendations,
            weekly_plan: parsed.weekly_plan || DEFAULT_CORA.weekly_plan,
            tasks: Array.isArray(parsed.tasks) ? parsed.tasks : DEFAULT_CORA.tasks,
            study_time_minutes:
              typeof parsed.study_time_minutes === "number"
                ? parsed.study_time_minutes
                : DEFAULT_CORA.study_time_minutes,
          }
        }
      } catch (aiError) {
        if (isInsufficientCoraCredits(aiError)) {
          return jsonFromCodebenchCoraError(aiError, "Failed to load analytics")
        }
        console.error("[codebench/analytics] Cora insight failed:", aiError)
        if (performance.avgScore > 0) {
          cora = {
            ...DEFAULT_CORA,
            overview: `Across ${performance.submissionCount} submissions, your average score is ${performance.avgScore}. Keep practicing to lift weaker concepts.`,
            proficiencyScore: performance.avgScore,
            detailedBreakdown: [
              {
                title: "Score average",
                detail: `Observed average evaluation score is ${performance.avgScore}/100 across recent work.`,
                severity: "info",
              },
              {
                title: "Activity volume",
                detail: `${performance.submissionCount} submissions logged (${performance.approvedCount} approved).`,
                severity: performance.submissionCount >= 5 ? "strength" : "focus",
              },
              {
                title: "Streak",
                detail:
                  streakDays > 0
                    ? `Current coding streak: ${streakDays} day(s).`
                    : "No active streak yet — a daily challenge can start one.",
                severity: streakDays > 0 ? "strength" : "focus",
              },
            ],
          }
        }
      }
    }

    return NextResponse.json({
      performance,
      cora,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[codebench/analytics] error:", error)
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 })
  }
}
