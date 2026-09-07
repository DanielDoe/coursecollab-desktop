import { logSystemEvent } from "@/lib/system-log"
import { normalizeQuestionMediaPath } from "@/lib/question-media-proxy"

export type AssetFailureContext = {
  assetUrl: string
  assetType?: "image" | "pdf" | "video" | "audio" | "document" | "other"
  httpStatus?: number
  moduleName?: string
  featureName?: string
  pageUrl?: string | null
  route?: string | null
  userId?: string | null
  userRole?: string | null
  metadata?: Record<string, unknown>
}

const reportedServer = new Set<string>()

function normalizeAssetKey(url: string): string {
  const trimmed = normalizeQuestionMediaPath(url.trim())
  if (!trimmed) return ""
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed)
      return `${parsed.pathname}${parsed.search}`
    }
  } catch {
    /* keep trimmed */
  }
  return trimmed.split("?")[0] ?? trimmed
}

function inferAssetType(url: string): AssetFailureContext["assetType"] {
  const lower = url.toLowerCase().split("?")[0] ?? url
  if (lower.endsWith(".pdf")) return "pdf"
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico)$/.test(lower)) return "image"
  if (/\.(mp4|webm|mov)$/.test(lower)) return "video"
  if (/\.(mp3|wav|ogg|m4a)$/.test(lower)) return "audio"
  if (/\.(doc|docx|ppt|pptx|xls|xlsx)$/.test(lower)) return "document"
  return "other"
}

/** Server-side: log a missing/broken uploaded asset to grouped system logs (deduped per process). */
export async function logMissingAsset(context: AssetFailureContext): Promise<string | null> {
  const assetUrl = context.assetUrl?.trim()
  if (!assetUrl) return null

  const key = normalizeAssetKey(assetUrl)
  if (!key) return null
  if (reportedServer.has(key)) return null
  reportedServer.add(key)

  const assetType = context.assetType ?? inferAssetType(assetUrl)
  const status = context.httpStatus ?? 404

  return logSystemEvent({
    severity: status >= 500 ? "critical" : "error",
    category: "storage",
    title: `Missing ${assetType ?? "asset"}: ${key.split("/").slice(-2).join("/")}`,
    errorMessage: `Uploaded asset not found (${status}): ${key}`,
    moduleName: context.moduleName ?? "Platform Module",
    featureName: context.featureName ?? "Asset delivery",
    pageUrl: context.pageUrl ?? undefined,
    route: context.route ?? undefined,
    userId: context.userId ?? undefined,
    userRole: context.userRole ?? undefined,
    httpStatusCode: status,
    metadata: {
      assetUrl: key,
      assetType,
      originalUrl: assetUrl,
      ...(context.metadata ?? {}),
    },
    rootCauseHints: [
      "Legacy /uploads/ path in DB — run npm run migrate:uploads-to-blob -- --apply on the machine that has the files",
      "New uploads require BLOB_READ_WRITE_TOKEN; DB should store https blob URLs",
    ],
    groupFingerprint: `asset-missing:${key}`,
    groupStatus: "open",
    groupOnRecurrence: "reopen_resolved",
    alwaysGroup: true,
  })
}
