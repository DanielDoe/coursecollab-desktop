import { createHmac, timingSafeEqual } from "crypto"
import { getBaseUrl } from "@/lib/get-base-url"

export const LECTURE_DECK_TTL_SECONDS = 15 * 60

const DECK_URL_KEYS = [
  "pdf_url",
  "pdfUrl",
  "document_url",
  "original_file_url",
  "originalFileUrl",
  "materials_url",
  "thumbnail_url",
  "thumbnailUrl",
] as const

function deckSecretOrNull(): string | null {
  const fromEnv =
    process.env.LECTURE_DECK_SIGNING_SECRET?.trim() ||
    process.env.MFA_ENCRYPTION_KEY?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  if (fromEnv) return fromEnv
  if (process.env.NODE_TEST_CONTEXT || process.env.NODE_ENV === "test") {
    return "lecture-deck-test-secret"
  }
  if (process.env.NODE_ENV === "development") {
    return "lecture-deck-dev-secret"
  }
  return null
}

function deckSecret(): string {
  const secret = deckSecretOrNull()
  if (secret) return secret
  throw new Error("Lecture deck signing secret is not configured")
}

function hmacHex(value: string): string {
  return createHmac("sha256", deckSecret()).update(value).digest("hex")
}

function safeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex")
  const b = Buffer.from(right, "hex")
  if (a.length === 0 || a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function isDirectLectureAssetUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false
  const trimmed = value.trim()
  if (trimmed.includes("/api/student/lectures/") && trimmed.includes("/deck")) return false
  return (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("/uploads/") ||
    trimmed.startsWith("/ece2202/") ||
    trimmed.startsWith("/eleg130x/")
  )
}

export function signStudentLectureDeckToken(params: {
  lectureId: number
  studentDbId: number
  ttlSeconds?: number
}): { exp: number; sig: string } {
  const exp = Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? LECTURE_DECK_TTL_SECONDS)
  const sig = hmacHex(`student:${params.studentDbId}:${params.lectureId}:${exp}`)
  return { exp, sig }
}

export function verifyStudentLectureDeckToken(params: {
  lectureId: number
  studentDbId: number
  exp: number
  sig: string
}): boolean {
  if (!Number.isFinite(params.exp) || params.exp * 1000 <= Date.now()) return false
  if (!Number.isFinite(params.studentDbId) || params.studentDbId <= 0) return false
  const expected = hmacHex(`student:${params.studentDbId}:${params.lectureId}:${params.exp}`)
  return safeEqualHex(expected, params.sig.trim().toLowerCase())
}

export function studentLectureDeckUrl(params: {
  lectureId: number
  studentDbId: number
  origin?: string | null
  ttlSeconds?: number
}): string {
  const { exp, sig } = signStudentLectureDeckToken(params)
  const origin = getBaseUrl(params.origin)
  const search = new URLSearchParams({
    exp: String(exp),
    sid: String(params.studentDbId),
    sig,
  })
  return `${origin}/api/student/lectures/${params.lectureId}/deck?${search.toString()}`
}

export function applySignedLectureDeckUrls<T extends Record<string, unknown>>(
  row: T,
  params: { studentDbId: number; origin?: string | null },
): T {
  if (!deckSecretOrNull()) return row
  const lectureId = Number(row.id ?? row.lecture_id ?? row.lectureId)
  if (!Number.isFinite(lectureId) || lectureId <= 0) return row
  const signed = studentLectureDeckUrl({
    lectureId,
    studentDbId: params.studentDbId,
    origin: params.origin,
  })
  const next = { ...row }
  for (const key of DECK_URL_KEYS) {
    if (isDirectLectureAssetUrl(next[key])) {
      ;(next as Record<string, unknown>)[key] = signed
    }
  }
  return next
}

export function applySignedLectureDeckUrlsToRows<T extends Record<string, unknown>>(
  rows: T[],
  params: { studentDbId: number; origin?: string | null },
): T[] {
  return rows.map((row) => applySignedLectureDeckUrls(row, params))
}

export function resolveLectureStoredDeckUrl(row: Record<string, unknown>): string | null {
  const candidates = [
    row.pdf_url,
    row.pdfUrl,
    row.document_url,
    row.original_file_url,
    row.originalFileUrl,
    row.materials_url,
  ]
  for (const value of candidates) {
    if (typeof value !== "string" || !value.trim()) continue
    const trimmed = value.trim()
    if (!isDirectLectureAssetUrl(trimmed)) continue
    return trimmed
  }
  return null
}
