import { type NextRequest, NextResponse } from "next/server"
import { ensureCoraAiAccountingSchema } from "@/lib/cora/ai"
import {
  adoptionMetrics,
  engagementMetrics,
  featureMix,
  learningSupportMetrics,
  outcomesCorrelation,
  type AdoptionMetrics,
  type EngagementMetrics,
  type FeatureMixMetrics,
  type LearningSupportMetrics,
  type OutcomesCorrelationMetrics,
} from "@/lib/cora/analytics/ai-usage-analytics"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = "force-dynamic"

function parseDateParam(value: string | null): string | undefined {
  if (!value?.trim()) return undefined
  return value.trim().slice(0, 10)
}

function valueByKey<T extends { key: string; runs?: number; activeUsers?: number }>(
  rows: T[],
  matcher: RegExp,
): T | undefined {
  return rows.find((row) => matcher.test(row.key) || matcher.test(String((row as { name?: string }).name ?? "")))
}

function getAfterHoursShare(metrics: EngagementMetrics): number {
  const late = metrics.byHourOfDay.filter((row) => row.hour >= 22 || row.hour <= 5).reduce((sum, row) => sum + row.requests, 0)
  const total = metrics.byHourOfDay.reduce((sum, row) => sum + row.requests, 0)
  return total > 0 ? late / total : 0
}

type DetailedOutcomeBucket = Extract<OutcomesCorrelationMetrics["buckets"][number], { studentCount: number }>

function isDetailedOutcomeBucket(
  bucket: OutcomesCorrelationMetrics["buckets"][number],
): bucket is DetailedOutcomeBucket {
  return !("suppressed" in bucket)
}

function buildFacultyInsights(input: {
  engagement: EngagementMetrics
  featureMix: FeatureMixMetrics
  learningSupport: LearningSupportMetrics
  outcomesCorrelation: OutcomesCorrelationMetrics
}): string[] {
  const insights: string[] = []
  const lateShare = getAfterHoursShare(input.engagement)
  if (lateShare >= 0.25) {
    insights.push(
      `${Math.round(lateShare * 100)}% of AI study sessions happen after 10pm - consider releasing practice material earlier or sending an earlier reminder.`,
    )
  }

  if (input.learningSupport.studySupportShare >= 50 && input.learningSupport.studySupportRuns >= 20) {
    const practiceRow = valueByKey(input.learningSupport.studySupportByFeature, /practice|quiz_generation/i)
    const flashcardRow = valueByKey(input.learningSupport.studySupportByFeature, /flashcard/i)
    const combinedStudySupport = (practiceRow?.runs ?? 0) + (flashcardRow?.runs ?? 0)
    if (combinedStudySupport / Math.max(1, input.learningSupport.studySupportRuns) < 0.2) {
      insights.push(
        "Students rely on AI for study support, but practice and flashcard usage are still thin - promote the practice generator and flashcard deck as low-friction review tools.",
      )
    }
  }

  const heavy = input.outcomesCorrelation.buckets.find(
    (bucket): bucket is DetailedOutcomeBucket => isDetailedOutcomeBucket(bucket) && bucket.key === "heavy",
  )
  const light = input.outcomesCorrelation.buckets.find(
    (bucket): bucket is DetailedOutcomeBucket => isDetailedOutcomeBucket(bucket) && bucket.key === "light",
  )
  if (
    heavy &&
    light &&
    heavy.studentCount >= 5 &&
    light.studentCount >= 5 &&
    heavy.avgQuizPercent != null &&
    light.avgQuizPercent != null
  ) {
    const gap = heavy.avgQuizPercent - light.avgQuizPercent
    if (gap >= 8) {
      insights.push(
        `Students using AI heavily score about ${Math.round(gap)} points higher on average than light users - consider promoting the practice workflow in course announcements.`,
      )
    }
  }

  if (input.learningSupport.integrityRefusals.count > 0) {
    insights.push(
      `${input.learningSupport.integrityRefusals.count} integrity-related refusals were observed - keep assessment guardrails visible and point students to study-plan and practice tools when answers are blocked.`,
    )
  }

  if (input.engagement.successRate < 95) {
    insights.push(
      `Success rate is ${input.engagement.successRate.toFixed(1)}% - review failed Cora calls and low-confidence workflows before expanding usage.`,
    )
  }

  if (insights.length === 0) {
    insights.push(
      "Cora usage looks healthy and broadly distributed - keep reinforcing study support workflows and revisit the dashboard after the next activity cycle.",
    )
  }

  return insights
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureCoraAiAccountingSchema()

    const url = new URL(request.url)
    const from = parseDateParam(url.searchParams.get("from"))
    const to = parseDateParam(url.searchParams.get("to"))
    const courseId = scope.course.id
    const analyticsScope = { courseId, from, to }

    const [adoption, engagement, featureMixMetrics, learningSupport, outcomes] = await Promise.all([
      adoptionMetrics(analyticsScope),
      engagementMetrics(analyticsScope),
      featureMix(analyticsScope),
      learningSupportMetrics(analyticsScope),
      outcomesCorrelation(analyticsScope),
    ])

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      scope: {
        courseId,
        courseCode: scope.course.course_code,
        courseTitle: scope.course.course_title,
      },
      adoption,
      engagement,
      featureMix: featureMixMetrics,
      learningSupport,
      outcomesCorrelation: outcomes,
      insights: buildFacultyInsights({
        engagement,
        featureMix: featureMixMetrics,
        learningSupport,
        outcomesCorrelation: outcomes,
      }),
    })
  } catch (error) {
    console.error("[instructor/cora/ai-analytics]", error)
    return NextResponse.json({ error: "Failed to load Cora AI analytics" }, { status: 500 })
  }
}
