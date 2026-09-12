import type { NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { listCourseStudentIds } from "@/lib/midterm-progress-review/gather-student-data"
import {
  loadCoraInsightTurns,
  type CoraInsightTurn,
} from "@/lib/cora/instructor-cora-insights"

export async function loadInstructorAiMonitoring(request: NextRequest) {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope
  const session = readInstructorSessionScopeFromRequest(request)
  const [turns, rosterIds] = await Promise.all([
    loadCoraInsightTurns({
      instructorId: scope.instructorId,
      courseId: scope.course.id,
      sessionId: session.sessionId,
      academicTermId: session.sessionId != null ? null : session.academicTermId,
    }),
    listCourseStudentIds(scope.course.id, session),
  ])
  const rosterRows =
    rosterIds.length === 0
      ? []
      : ((await sql`
          SELECT s.id, s.full_name, s.student_id, s.section
          FROM students s
          WHERE s.id = ANY(${rosterIds})
        `) as Array<{ id: number; full_name: string | null; student_id: string | null; section: string | null }>)
  const roster = rosterRows.map((r) => ({
    id: Number(r.id),
    full_name: String(r.full_name ?? `Student ${r.id}`),
    student_id: r.student_id != null ? String(r.student_id) : "",
    section: r.section != null ? String(r.section) : null,
  }))
  return { ok: true as const, turns, rosterIds, roster }
}

function inWindow(turns: CoraInsightTurn[], sinceMs: number) {
  return turns.filter((t) => t.createdAt.getTime() >= sinceMs)
}

function hoursAgo(hours: number) {
  return Date.now() - hours * 60 * 60 * 1000
}

function daysAgo(days: number) {
  return Date.now() - days * 24 * 60 * 60 * 1000
}

export function buildAiMonitoringActivity(turns: CoraInsightTurn[], minutes: number) {
  const windowed = inWindow(turns, Date.now() - minutes * 60 * 1000)
  const activity = windowed.slice(0, 80).map((t, idx) => ({
    id: idx + 1,
    student_id: t.studentId,
    student_name: t.studentName,
    student_number: t.studentCode,
    section: t.section,
    message: t.message,
    response: t.response,
    topic: t.topic,
    created_at: t.createdAt.toISOString(),
    response_time: t.response ? 1200 : 0,
    module: t.module,
    source: t.source,
  }))
  const stats = {
    active_students: new Set(windowed.map((t) => t.studentId)).size,
    total_questions: windowed.length,
    avg_response_time: 0,
    topics_discussed: new Set(windowed.map((t) => t.topic)).size,
  }
  return { activity, stats, timeRange: `Last ${minutes} minutes` }
}

export function buildAiMonitoringHotTopics(turns: CoraInsightTurn[], hours: number) {
  const current = inWindow(turns, hoursAgo(hours))
  const previous = turns.filter(
    (t) => t.createdAt.getTime() >= hoursAgo(hours * 2) && t.createdAt.getTime() < hoursAgo(hours),
  )
  const groups = new Map<
    string,
    { question_count: number; students: Set<string>; last_asked: Date }
  >()
  for (const t of current) {
    if (t.topic === "Course help") continue
    const row = groups.get(t.topic) ?? {
      question_count: 0,
      students: new Set<string>(),
      last_asked: t.createdAt,
    }
    row.question_count += 1
    row.students.add(t.studentName)
    if (t.createdAt > row.last_asked) row.last_asked = t.createdAt
    groups.set(t.topic, row)
  }
  const prevCount = new Map<string, number>()
  for (const t of previous) {
    prevCount.set(t.topic, (prevCount.get(t.topic) ?? 0) + 1)
  }
  const hotTopics = [...groups.entries()]
    .map(([topic, row]) => {
      const currentCount = row.question_count
      const previousCount = prevCount.get(topic) ?? 0
      let trend = "stable"
      let trendPercentage = 0
      if (previousCount > 0) {
        trendPercentage = ((currentCount - previousCount) / previousCount) * 100
        if (trendPercentage > 20) trend = "rising"
        else if (trendPercentage < -20) trend = "falling"
      } else if (currentCount > 0) {
        trend = "new"
        trendPercentage = 100
      }
      return {
        topic,
        question_count: currentCount,
        student_count: row.students.size,
        students: [...row.students],
        last_asked: row.last_asked.toISOString(),
        trend,
        trendPercentage: Math.round(trendPercentage),
      }
    })
    .sort((a, b) => b.question_count - a.question_count)
    .slice(0, 12)
  return { hotTopics, timeRange: `Last ${hours} hours` }
}

export function buildAiMonitoringStruggles(
  turns: CoraInsightTurn[],
  hours: number,
  threshold: number,
) {
  const windowed = inWindow(turns, hoursAgo(hours)).filter((t) => t.topic !== "Course help")
  const groups = new Map<
    string,
    {
      student_id: number
      student_name: string
      student_number: string
      section: string | null
      topic: string
      messages: string[]
      first_asked: Date
      last_asked: Date
    }
  >()
  for (const t of windowed) {
    const key = `${t.studentId}|${t.topic}`
    const existing = groups.get(key)
    if (existing) {
      existing.messages.push(t.message)
      if (t.createdAt < existing.first_asked) existing.first_asked = t.createdAt
      if (t.createdAt > existing.last_asked) existing.last_asked = t.createdAt
    } else {
      groups.set(key, {
        student_id: t.studentId,
        student_name: t.studentName,
        student_number: t.studentCode,
        section: t.section,
        topic: t.topic,
        messages: [t.message],
        first_asked: t.createdAt,
        last_asked: t.createdAt,
      })
    }
  }
  const struggles = [...groups.values()]
    .filter((row) => row.messages.length >= threshold)
    .map((row) => {
      const question_count = row.messages.length
      const time_span_minutes = Math.max(
        (row.last_asked.getTime() - row.first_asked.getTime()) / 60000,
        1,
      )
      const questionsPerHour = question_count / Math.max(time_span_minutes / 60, 0.5)
      let severity = "low"
      if (questionsPerHour >= 4 || question_count >= 6) severity = "critical"
      else if (questionsPerHour >= 2 || question_count >= 4) severity = "high"
      else if (question_count >= threshold) severity = "medium"
      return {
        ...row,
        question_count,
        time_span_minutes,
        questionsPerHour: Math.round(questionsPerHour * 10) / 10,
        severity,
        first_asked: row.first_asked.toISOString(),
        last_asked: row.last_asked.toISOString(),
      }
    })
    .sort((a, b) => b.question_count - a.question_count)

  const topicMap = new Map<string, { students: Set<number>; questions: number }>()
  for (const row of struggles) {
    const t = topicMap.get(row.topic) ?? { students: new Set<number>(), questions: 0 }
    t.students.add(row.student_id)
    t.questions += row.question_count
    topicMap.set(row.topic, t)
  }
  const topicSummary = [...topicMap.entries()]
    .map(([topic, row]) => ({
      topic,
      struggling_students: row.students.size,
      total_questions: row.questions,
    }))
    .sort((a, b) => b.struggling_students - a.struggling_students)
    .slice(0, 5)

  return {
    struggles,
    topicSummary,
    criticalCount: struggles.filter((s) => s.severity === "critical").length,
    highCount: struggles.filter((s) => s.severity === "high").length,
    timeRange: `Last ${hours} hours`,
  }
}

export function buildAiMonitoringEngagement(
  turns: CoraInsightTurn[],
  rosterIds: number[],
  days: number,
  rosterProfiles?: Array<{
    id: number
    full_name: string
    student_id: string
    section: string | null
  }>,
) {
  const windowed = inWindow(turns, daysAgo(days))
  const byStudent = new Map<number, CoraInsightTurn[]>()
  for (const t of windowed) {
    const list = byStudent.get(t.studentId) ?? []
    list.push(t)
    byStudent.set(t.studentId, list)
  }
  const roster = new Set(rosterIds)
  const activeUsersList = [...byStudent.entries()]
    .filter(([id]) => roster.size === 0 || roster.has(id))
    .map(([id, list]) => {
      const daysActive = new Set(list.map((t) => t.createdAt.toISOString().slice(0, 10)))
      const first = list.reduce((min, t) => (t.createdAt < min ? t.createdAt : min), list[0].createdAt)
      const last = list.reduce((max, t) => (t.createdAt > max ? t.createdAt : max), list[0].createdAt)
      return {
        id,
        full_name: list[0].studentName,
        student_id: list[0].studentCode,
        section: list[0].section,
        question_count: list.length,
        active_days: daysActive.size,
        last_active: last.toISOString(),
        first_active: first.toISOString(),
      }
    })
    .sort((a, b) => b.question_count - a.question_count)

  const activeIds = new Set(activeUsersList.map((u) => u.id))
  const profileById = new Map((rosterProfiles ?? []).map((p) => [p.id, p]))
  const inactiveUsersList = rosterIds
    .filter((id) => !activeIds.has(id))
    .map((id) => {
      const profile = profileById.get(id)
      const sample = turns.find((t) => t.studentId === id)
      return {
        id,
        full_name: profile?.full_name ?? sample?.studentName ?? `Student ${id}`,
        student_id: profile?.student_id ?? sample?.studentCode ?? "",
        section: profile?.section ?? sample?.section ?? null,
        last_active: sample?.createdAt.toISOString() ?? null,
      }
    })

  const totalStudents = rosterIds.length
  const engagementLevels = {
    high: activeUsersList.filter((u) => u.question_count >= 10).length,
    medium: activeUsersList.filter((u) => u.question_count >= 5 && u.question_count < 10).length,
    low: activeUsersList.filter((u) => u.question_count > 0 && u.question_count < 5).length,
    none: Math.max(0, totalStudents - activeUsersList.length),
  }
  const engagementRate =
    totalStudents > 0 ? Math.round((activeUsersList.length / totalStudents) * 1000) / 10 : 0

  return {
    totalStudents,
    activeUsers: activeUsersList.length,
    inactiveUsers: engagementLevels.none,
    totalQuestions: windowed.length,
    engagementRate,
    engagementLevels,
    activeUsersList,
    inactiveUsersList: inactiveUsersList.slice(0, 50),
    timeRange: `Last ${days} days`,
  }
}

export function buildAiMonitoringPeakUsage(turns: CoraInsightTurn[], days: number) {
  const windowed = inWindow(turns, daysAgo(days))
  const hourly = new Map<number, { question_count: number; student_count: Set<number> }>()
  const daily = new Map<number, { question_count: number; student_count: Set<number> }>()
  const byDate = new Map<
    string,
    { question_count: number; student_count: Set<number>; topics: Set<string> }
  >()
  for (const t of windowed) {
    const hour = t.createdAt.getUTCHours()
    const dow = t.createdAt.getUTCDay()
    const date = t.createdAt.toISOString().slice(0, 10)
    const h = hourly.get(hour) ?? { question_count: 0, student_count: new Set() }
    h.question_count += 1
    h.student_count.add(t.studentId)
    hourly.set(hour, h)
    const d = daily.get(dow) ?? { question_count: 0, student_count: new Set() }
    d.question_count += 1
    d.student_count.add(t.studentId)
    daily.set(dow, d)
    const day = byDate.get(date) ?? { question_count: 0, student_count: new Set(), topics: new Set() }
    day.question_count += 1
    day.student_count.add(t.studentId)
    day.topics.add(t.topic)
    byDate.set(date, day)
  }
  const hourlyUsage = [...Array(24).keys()].map((hour) => ({
    hour,
    question_count: hourly.get(hour)?.question_count ?? 0,
    student_count: hourly.get(hour)?.student_count.size ?? 0,
  }))
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const dailyUsage = dayNames.map((day_name, day_of_week) => ({
    day_of_week,
    day_name,
    question_count: daily.get(day_of_week)?.question_count ?? 0,
    student_count: daily.get(day_of_week)?.student_count.size ?? 0,
  }))
  const dateUsage = [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, row]) => ({
      date,
      question_count: row.question_count,
      student_count: row.student_count.size,
      topics_discussed: row.topics.size,
    }))
  const peakHourRow = hourlyUsage.reduce(
    (max, cur) => (cur.question_count > max.question_count ? cur : max),
    hourlyUsage[0],
  )
  const peakDayRow = dailyUsage.reduce(
    (max, cur) => (cur.question_count > max.question_count ? cur : max),
    dailyUsage[0],
  )
  const sumHours = (hours: number[]) =>
    hours.reduce((sum, h) => sum + (hourly.get(h)?.question_count ?? 0), 0)
  return {
    hourlyUsage,
    dailyUsage,
    dateUsage,
    peakHour:
      peakHourRow.question_count > 0
        ? {
            hour: peakHourRow.hour,
            hourFormatted: `${peakHourRow.hour}:00`,
            questionCount: peakHourRow.question_count,
            studentCount: peakHourRow.student_count,
          }
        : null,
    peakDay:
      peakDayRow.question_count > 0
        ? {
            day: peakDayRow.day_name,
            questionCount: peakDayRow.question_count,
            studentCount: peakDayRow.student_count,
          }
        : null,
    timePatterns: {
      morning: sumHours([6, 7, 8, 9, 10, 11]),
      afternoon: sumHours([12, 13, 14, 15, 16, 17]),
      evening: sumHours([18, 19, 20, 21, 22, 23]),
      night: sumHours([0, 1, 2, 3, 4, 5]),
    },
    timeRange: `Last ${days} days`,
  }
}

export function buildAiMonitoringDifficulty(turns: CoraInsightTurn[], days: number) {
  const windowed = inWindow(turns, daysAgo(days)).filter((t) => t.topic !== "Course help")
  const groups = new Map<string, { questions: number; students: Set<number>; repeats: number }>()
  const studentTopic = new Map<string, number>()
  for (const t of windowed) {
    const row = groups.get(t.topic) ?? { questions: 0, students: new Set<number>(), repeats: 0 }
    row.questions += 1
    row.students.add(t.studentId)
    groups.set(t.topic, row)
    const key = `${t.studentId}|${t.topic}`
    studentTopic.set(key, (studentTopic.get(key) ?? 0) + 1)
  }
  for (const [key, count] of studentTopic) {
    if (count < 2) continue
    const topic = key.split("|").slice(1).join("|")
    const row = groups.get(topic)
    if (row) row.repeats += 1
  }
  const maxQ = Math.max(1, ...[...groups.values()].map((g) => g.questions))
  const maxS = Math.max(1, ...[...groups.values()].map((g) => g.students.size))
  const topicDifficulty = [...groups.entries()]
    .filter(([, row]) => row.questions >= 2)
    .map(([topic, row]) => {
      const difficulty_score = Math.round(
        (row.questions / maxQ) * 40 + (row.students.size / maxS) * 30 + (row.repeats / Math.max(row.students.size, 1)) * 30,
      )
      const category =
        difficulty_score >= 80
          ? "very_hard"
          : difficulty_score >= 60
            ? "hard"
            : difficulty_score >= 40
              ? "moderate"
              : "medium"
      return {
        topic,
        total_questions: row.questions,
        unique_students: row.students.size,
        difficulty_score,
        category,
        avg_questions_per_student: Math.round((row.questions / Math.max(row.students.size, 1)) * 10) / 10,
      }
    })
    .sort((a, b) => b.difficulty_score - a.difficulty_score)
  return {
    topicDifficulty,
    summary: {
      topics: topicDifficulty.length,
      hardest: topicDifficulty[0]?.topic ?? null,
    },
  }
}
