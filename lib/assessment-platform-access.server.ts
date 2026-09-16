import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAssessmentPolicyForCourse } from "@/lib/assessment-policy-settings.server"
import { ensureQuizPlatformAccessColumn } from "@/lib/ensure-quiz-platform-access-column"
import {
  ASSESSMENT_PLATFORM_DISABLED_CODE,
  assessmentPlatformBlockedMessage,
  isAssessmentPlatformAllowed,
  parseAssessmentPlatformOverride,
  resolveAssessmentPlatformFlags,
  type AssessmentPlatformId,
} from "@/lib/assessment-platform-access"
import { parseExplicitClientPlatform, resolveClientPlatform } from "@/lib/client-platform"

/** Resolve the calling client. Body/query/header win; User-Agent is the fallback. */
export function resolveAssessmentClientPlatform(request: NextRequest, body?: unknown): AssessmentPlatformId {
  const fromBody =
    body && typeof body === "object"
      ? parseExplicitClientPlatform(
          (body as Record<string, unknown>).clientPlatform ?? (body as Record<string, unknown>).platform,
        )
      : null
  if (fromBody) return fromBody

  return resolveClientPlatform({
    explicit: request.nextUrl.searchParams.get("clientPlatform"),
    header: request.headers.get("x-client-platform"),
    userAgent: request.headers.get("user-agent"),
  })
}

export async function assessmentPlatformGateResponse(
  courseId: number | null | undefined,
  assessmentType: string | null | undefined,
  platform: AssessmentPlatformId,
  quizOverride?: unknown,
): Promise<NextResponse | null> {
  if (courseId == null || !Number.isFinite(courseId)) return null
  const policy = await getAssessmentPolicyForCourse(courseId)
  const access = policy.access.platform_access
  if (isAssessmentPlatformAllowed(access, assessmentType, platform, quizOverride)) return null

  const resolved = resolveAssessmentPlatformFlags(access, assessmentType, quizOverride)
  return NextResponse.json(
    {
      error: assessmentPlatformBlockedMessage(assessmentType, platform),
      code: ASSESSMENT_PLATFORM_DISABLED_CODE,
      platform,
      platform_access: resolved,
      inherited: parseAssessmentPlatformOverride(quizOverride) == null,
    },
    { status: 403 },
  )
}

export async function attachQuizPlatformAccess<T extends { id?: unknown }>(rows: T[]): Promise<T[]> {
  const ids = [...new Set(rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id)))]
  if (ids.length === 0) return rows
  try {
    await ensureQuizPlatformAccessColumn()
    const mapped = await sql`
      SELECT id, platform_access FROM quizzes WHERE id = ANY(${ids}::int[])
    `
    const byId = new Map(
      (mapped as { id: unknown; platform_access: unknown }[]).map((row) => [
        Number(row.id),
        row.platform_access ?? null,
      ]),
    )
    return rows.map((row) => ({
      ...row,
      platform_access: byId.get(Number(row.id)) ?? null,
    }))
  } catch {
    return rows
  }
}
