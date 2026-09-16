import { NATIVE_APP_UA_TOKEN } from "@/lib/mobile-native-app"

/** Client surface used to access CourseCollab (login / activity). */
export const CLIENT_PLATFORM_IDS = ["web", "mobile", "desktop"] as const
export type ClientPlatformId = (typeof CLIENT_PLATFORM_IDS)[number]

export function isClientPlatformId(value: unknown): value is ClientPlatformId {
  return value === "web" || value === "mobile" || value === "desktop"
}

export function clientPlatformLabel(id: ClientPlatformId | null | undefined): string {
  switch (id) {
    case "mobile":
      return "Mobile app"
    case "desktop":
      return "Desktop app"
    case "web":
      return "Web"
    default:
      return "Unknown"
  }
}

/** Parse explicit client platform from header/body/query/metadata. */
export function parseExplicitClientPlatform(raw: unknown): ClientPlatformId | null {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase()
  if (!v) return null
  if (v === "mobile" || v === "app" || v === "native" || v === "ios" || v === "android" || v === "mobile_app") {
    return "mobile"
  }
  if (v === "desktop" || v === "electron" || v === "pc" || v === "desktop_app") return "desktop"
  if (v === "web" || v === "browser" || v === "web_app") return "web"
  return null
}

/**
 * Infer client platform from User-Agent.
 * Native mobile uses `CourseCollab-Native`; desktop Electron uses `Electron` / `CourseCollab-Desktop`.
 */
export function resolveClientPlatformFromUserAgent(
  userAgent: string | null | undefined,
): ClientPlatformId {
  const ua = (userAgent ?? "").toLowerCase()
  if (!ua) return "web"

  if (
    ua.includes(NATIVE_APP_UA_TOKEN.toLowerCase()) ||
    ua.includes("com.coursecollab.app") ||
    ua.includes("expobundle") ||
    ua.includes("okhttp")
  ) {
    return "mobile"
  }

  if (ua.includes("electron") || ua.includes("coursecollab-desktop")) {
    return "desktop"
  }

  return "web"
}

/** Prefer explicit header/param, then User-Agent. */
export function resolveClientPlatform(input: {
  explicit?: unknown
  header?: string | null
  userAgent?: string | null
}): ClientPlatformId {
  const fromExplicit = parseExplicitClientPlatform(input.explicit)
  if (fromExplicit) return fromExplicit
  const fromHeader = parseExplicitClientPlatform(input.header)
  if (fromHeader) return fromHeader
  return resolveClientPlatformFromUserAgent(input.userAgent)
}

export function resolveClientPlatformFromRequest(request: {
  headers: Headers
  nextUrl?: { searchParams: URLSearchParams }
}): ClientPlatformId {
  const header = request.headers.get("x-client-platform")
  const fromQuery = request.nextUrl?.searchParams.get("clientPlatform")
  return resolveClientPlatform({
    explicit: fromQuery,
    header,
    userAgent: request.headers.get("user-agent"),
  })
}

/** Resolve platform for an activity log row (metadata first, then UA). */
export function resolveActivityClientPlatform(row: {
  metadata?: Record<string, unknown> | null
  user_agent?: string | null
}): ClientPlatformId {
  const meta = row.metadata
  const fromMeta = parseExplicitClientPlatform(
    meta?.clientPlatform ?? meta?.client_platform ?? meta?.platform,
  )
  if (fromMeta) return fromMeta
  return resolveClientPlatformFromUserAgent(row.user_agent)
}
