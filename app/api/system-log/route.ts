import { type NextRequest, NextResponse } from "next/server"
import { logFrontendError, type SystemLogInput } from "@/lib/system-log"

export const dynamic = "force-dynamic"

const MAX_BATCH = 25
const MAX_FIELD_LEN = 8000

function sanitizeString(value: unknown, max = 2000): string | undefined {
  if (typeof value !== "string") return undefined
  return value.slice(0, max)
}

function normalizeLog(raw: Record<string, unknown>): SystemLogInput | null {
  const errorMessage = sanitizeString(raw.errorMessage, MAX_FIELD_LEN)
  if (!errorMessage) return null

  const severity = sanitizeString(raw.severity, 16) as SystemLogInput["severity"]
  const category = sanitizeString(raw.category, 32) as SystemLogInput["category"]
  if (!severity || !category) return null

  return {
    severity,
    category,
    title: sanitizeString(raw.title, 500),
    description: sanitizeString(raw.description, MAX_FIELD_LEN),
    errorMessage,
    stackTrace: sanitizeString(raw.stackTrace, MAX_FIELD_LEN),
    moduleName: sanitizeString(raw.moduleName, 100),
    featureName: sanitizeString(raw.featureName, 100),
    pageUrl: sanitizeString(raw.pageUrl, 2000),
    route: sanitizeString(raw.route, 500),
    apiEndpoint: sanitizeString(raw.apiEndpoint, 500),
    httpMethod: sanitizeString(raw.httpMethod, 16),
    httpStatusCode:
      typeof raw.httpStatusCode === "number" ? Math.trunc(raw.httpStatusCode) : undefined,
    userId: sanitizeString(raw.userId, 64),
    userName: sanitizeString(raw.userName, 255),
    userRole: sanitizeString(raw.userRole, 64),
    courseId: typeof raw.courseId === "number" ? raw.courseId : undefined,
    courseName: sanitizeString(raw.courseName, 255),
    browser: sanitizeString(raw.browser, 100),
    operatingSystem: sanitizeString(raw.operatingSystem, 100),
    deviceType: sanitizeString(raw.deviceType, 64),
    screenResolution: sanitizeString(raw.screenResolution, 32),
    sessionId: sanitizeString(raw.sessionId, 128),
    executionTimeMs:
      typeof raw.executionTimeMs === "number" ? Math.trunc(raw.executionTimeMs) : undefined,
    metadata:
      typeof raw.metadata === "object" && raw.metadata !== null
        ? (raw.metadata as Record<string, unknown>)
        : undefined,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const logs: Record<string, unknown>[] = Array.isArray(body?.logs)
      ? body.logs
      : body
        ? [body]
        : []

    if (logs.length === 0) {
      return NextResponse.json({ error: "No logs provided" }, { status: 400 })
    }
    if (logs.length > MAX_BATCH) {
      return NextResponse.json({ error: `Max ${MAX_BATCH} logs per request` }, { status: 400 })
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null
    const userAgent = request.headers.get("user-agent")

    let accepted = 0
    for (const raw of logs) {
      const input = normalizeLog(raw as Record<string, unknown>)
      if (!input) continue
      await logFrontendError({
        ...input,
        ipAddress,
        userAgent,
      })
      accepted++
    }

    return NextResponse.json({ accepted }, { status: 202 })
  } catch (error) {
    console.warn("[system-log] ingest failed", error)
    return NextResponse.json({ accepted: 0 }, { status: 202 })
  }
}
