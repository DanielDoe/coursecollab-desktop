import { NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { sql } from "@/lib/db"
import { buildCodebenchCoraRead } from "@/lib/codebench-analytics-read"
import { fetchStudioSnapshotForStudent } from "@/lib/codebench-studio-server"

type SubmissionRow = {
  id: number
  score: number | null
  points_awarded: number | null
  status: string | null
  submitted_at: string | Date
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
      title:
        r.title ||
        (r.source === "challenge"
          ? "Daily challenge"
          : r.source === "practice"
            ? "Practice problem"
            : "CodeBench submit"),
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

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    const bound = await requireCodebenchStudent(request, studentId)
    if (!bound.ok) return bound.response

    const id = bound.studentDbId

    const [codeSubs, practiceSubs, challengeSubs, studio] = await Promise.all([
      sql`
        SELECT id, score, points_awarded, status, submitted_at
        FROM codebench_submissions
        WHERE student_id = ${id}
        ORDER BY submitted_at DESC
        LIMIT 40
      `,
      sql`
        SELECT id, problem as title, score, points_awarded, status, submitted_at
        FROM practice_submissions
        WHERE student_id = ${id}
        ORDER BY submitted_at DESC
        LIMIT 40
      `,
      sql`
        SELECT id, challenge_title as title, score, points_awarded, status, submitted_at
        FROM daily_challenge_submissions
        WHERE student_id = ${id}
        ORDER BY submitted_at DESC
        LIMIT 40
      `,
      fetchStudioSnapshotForStudent(id),
    ])

    const rows: SubmissionRow[] = [
      ...(codeSubs as any[]).map((r) => ({
        id: r.id,
        score: r.score,
        points_awarded: r.points_awarded,
        status: r.status,
        submitted_at: r.submitted_at,
        title: null,
        source: "codebench" as const,
      })),
      ...(practiceSubs as any[]).map((r) => ({
        id: r.id,
        score: r.score,
        points_awarded: r.points_awarded,
        status: r.status,
        submitted_at: r.submitted_at,
        title: typeof r.title === "string" ? r.title.slice(0, 80) : null,
        source: "practice" as const,
      })),
      ...(challengeSubs as any[]).map((r) => ({
        id: r.id,
        score: r.score,
        points_awarded: r.points_awarded,
        status: r.status,
        submitted_at: r.submitted_at,
        title: r.title ?? "Daily challenge",
        source: "challenge" as const,
      })),
    ]

    const streakDays = computeStreakDays(rows)
    const performance = buildPerformance(rows, streakDays)
    const cora = buildCodebenchCoraRead(performance, studio)

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
