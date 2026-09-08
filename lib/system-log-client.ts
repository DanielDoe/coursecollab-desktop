/**
 * Client-side system error capture and batch reporting.
 * Fire-and-forget — never blocks UI or throws.
 */

import type { LogCategory, LogSeverity } from "@/lib/system-log-constants"
import { buildSystemLogDescription } from "@/lib/system-log-diagnostics"

export type ClientLogPayload = {
  severity: LogSeverity
  category: LogCategory
  title?: string
  description?: string
  errorMessage?: string
  stackTrace?: string
  moduleName?: string
  featureName?: string
  pageUrl?: string
  route?: string
  apiEndpoint?: string
  httpMethod?: string
  httpStatusCode?: number
  userId?: string
  userName?: string
  userRole?: string
  courseId?: number
  courseName?: string
  browser?: string
  operatingSystem?: string
  deviceType?: string
  screenResolution?: string
  sessionId?: string
  executionTimeMs?: number
  metadata?: Record<string, unknown>
}

let logQueue: ClientLogPayload[] = []
let batchTimer: ReturnType<typeof setTimeout> | null = null
const BATCH_INTERVAL = 3000
const MAX_BATCH = 20
let sessionId: string | null = null

function getClientSessionId(): string {
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }
  return sessionId
}

function parseUserAgent(ua: string) {
  let browser = "Unknown"
  let os = "Unknown"
  let device = "desktop"

  if (/Edg\//i.test(ua)) browser = "Edge"
  else if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome"
  else if (/Firefox\//i.test(ua)) browser = "Firefox"
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari"

  if (/Windows/i.test(ua)) os = "Windows"
  else if (/Mac OS X/i.test(ua)) os = "macOS"
  else if (/Android/i.test(ua)) os = "Android"
  else if (/iPhone|iPad/i.test(ua)) os = "iOS"
  else if (/Linux/i.test(ua)) os = "Linux"

  if (/Mobi|Android/i.test(ua)) device = "mobile"
  else if (/Tablet|iPad/i.test(ua)) device = "tablet"

  return { browser, os, device }
}

function getClientContext() {
  if (typeof window === "undefined") return {}

  const ua = navigator.userAgent
  const { browser, os, device } = parseUserAgent(ua)
  const screen = `${window.screen.width}x${window.screen.height}`

  const studentId =
    sessionStorage.getItem("studentDatabaseId") ||
    sessionStorage.getItem("studentId") ||
    localStorage.getItem("studentId")
  const instructorId = localStorage.getItem("instructorId")
  const adminId = localStorage.getItem("adminId")

  let userId: string | undefined
  let userRole: string | undefined
  let userName: string | undefined

  if (studentId) {
    userId = studentId
    userRole = "student"
    userName = sessionStorage.getItem("studentName") ?? undefined
  } else if (instructorId) {
    userId = instructorId
    userRole = "instructor"
  } else if (adminId) {
    userId = adminId
    userRole = "admin"
  }

  const courseIdRaw = localStorage.getItem("selectedCourseId")
  const courseId = courseIdRaw ? Number(courseIdRaw) : undefined

  return {
    pageUrl: window.location.href,
    route: window.location.pathname,
    browser,
    operatingSystem: os,
    deviceType: device,
    screenResolution: screen,
    sessionId: getClientSessionId(),
    userId,
    userRole,
    userName,
    courseId: Number.isFinite(courseId) ? courseId : undefined,
  }
}

function inferModuleFromRoute(route: string): string {
  if (route.includes("/quiz")) return "Quiz Module"
  if (route.includes("/homework")) return "Homework Module"
  if (route.includes("/exam") || route.includes("/mid-semester")) return "Exam Module"
  if (route.includes("/lecture")) return "Lectures Module"
  if (route.includes("/gradebook") || route.includes("/results")) return "Gradebook Module"
  if (route.includes("/analytics")) return "Analytics Module"
  if (route.includes("/discussion")) return "Discussion Module"
  if (route.includes("/messaging") || route.includes("/notification")) return "Messaging Module"
  if (route.includes("/ai") || route.includes("/notetaker")) return "AI Assistant Module"
  if (route.includes("/summer-camp")) return "Summer Camp Module"
  if (route.includes("/admin")) return "Administration Module"
  if (route.includes("/attendance")) return "Attendance Module"
  if (route.includes("/assignment")) return "Assignments Module"
  if (route.includes("/practice")) return "Practice Module"
  if (route.includes("/trade")) return "Trade Center Module"
  return "Platform Module"
}

async function flushQueue() {
  if (logQueue.length === 0) return
  const batch = logQueue.splice(0, MAX_BATCH)

  try {
    await fetch("/api/system-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logs: batch }),
      keepalive: true,
    })
  } catch {
    /* silent */
  }
}

function scheduleFlush() {
  if (batchTimer) return
  batchTimer = setTimeout(() => {
    batchTimer = null
    void flushQueue()
  }, BATCH_INTERVAL)
}

/** Queue a client-side log for batched delivery */
export function reportClientError(partial: Partial<ClientLogPayload> & { errorMessage: string }): void {
  try {
    const errorName =
      typeof partial.metadata?.errorName === "string" ? partial.metadata.errorName : undefined
    if (tryAutoReloadOnChunkLoadError(partial.errorMessage, errorName)) return
    if (isChunkLoadErrorMessage(partial.errorMessage, errorName)) return
    if (isBenignBrowserError(partial.errorMessage, partial.stackTrace)) return

    const ctx = getClientContext()
    const route = partial.route ?? ctx.route ?? "/"
    const description =
      partial.description ??
      buildSystemLogDescription({
        severity: partial.severity ?? "error",
        category: partial.category ?? "frontend",
        title: partial.title,
        errorMessage: partial.errorMessage,
        stackTrace: partial.stackTrace,
        moduleName: partial.moduleName ?? inferModuleFromRoute(route),
        featureName: partial.featureName,
        pageUrl: partial.pageUrl ?? ctx.pageUrl,
        route,
        apiEndpoint: partial.apiEndpoint,
        httpMethod: partial.httpMethod,
        httpStatusCode: partial.httpStatusCode,
        userId: partial.userId ?? ctx.userId,
        userName: partial.userName ?? ctx.userName,
        userRole: partial.userRole ?? ctx.userRole,
        courseId: partial.courseId ?? ctx.courseId,
        courseName: partial.courseName,
        metadata: partial.metadata,
      })

    const payload: ClientLogPayload = {
      severity: partial.severity ?? "error",
      category: partial.category ?? "frontend",
      title: partial.title,
      description,
      errorMessage: partial.errorMessage,
      stackTrace: partial.stackTrace,
      moduleName: partial.moduleName ?? inferModuleFromRoute(route),
      featureName: partial.featureName,
      pageUrl: partial.pageUrl ?? ctx.pageUrl,
      route,
      apiEndpoint: partial.apiEndpoint,
      httpMethod: partial.httpMethod,
      httpStatusCode: partial.httpStatusCode,
      userId: partial.userId ?? ctx.userId,
      userName: partial.userName ?? ctx.userName,
      userRole: partial.userRole ?? ctx.userRole,
      courseId: partial.courseId ?? ctx.courseId,
      courseName: partial.courseName,
      browser: partial.browser ?? ctx.browser,
      operatingSystem: partial.operatingSystem ?? ctx.operatingSystem,
      deviceType: partial.deviceType ?? ctx.deviceType,
      screenResolution: partial.screenResolution ?? ctx.screenResolution,
      sessionId: partial.sessionId ?? ctx.sessionId,
      executionTimeMs: partial.executionTimeMs,
      metadata: partial.metadata,
    }

    logQueue.push(payload)
    if (logQueue.length >= MAX_BATCH) {
      void flushQueue()
    } else {
      scheduleFlush()
    }
  } catch {
    /* silent */
  }
}

const CHUNK_RELOAD_SESSION_KEY = "cc_chunk_reload"

function isChunkLoadError(message: string, errorName?: string): boolean {
  if (errorName === "ChunkLoadError") return true
  if (/Loading chunk .* failed/i.test(message)) return true
  // Vite / dynamic import failures during HMR or dep re-optimization
  if (/Failed to fetch dynamically imported module/i.test(message)) return true
  if (/Importing a module script failed/i.test(message)) return true
  if (/error loading dynamically imported module/i.test(message)) return true
  return false
}

/** Stale webpack chunks after deploy — auto-reload handles recovery; do not open log groups. */
export function isChunkLoadErrorMessage(message: string, errorName?: string): boolean {
  return isChunkLoadError(message, errorName)
}

/**
 * Extension-injected scripts hook appendChild and JSON.stringify DOM nodes (e.g. Link anchors).
 * Stack shows at <anonymous>:N and appendChild (<anonymous> — not application code.
 */
export function isBrowserExtensionDomNoise(message: string, stack?: string): boolean {
  if (!/Converting circular structure to JSON/i.test(message)) return false
  if (/HTMLAnchorElement|HTMLDivElement|HTMLElement|__reactFiber/i.test(message)) return true
  if (!stack) return false
  return (
    /at <anonymous>:\d+/.test(stack) ||
    /appendChild \(<anonymous>/i.test(stack) ||
    /chrome-extension:\/\//i.test(stack)
  )
}

/** Benign browser noise — not an application bug. */
function isBenignBrowserError(message: string, stack?: string): boolean {
  if (isBrowserExtensionDomNoise(message, stack)) return true
  if (/ResizeObserver loop completed with undelivered notifications/i.test(message)) return true
  // Cross-origin scripts hide details — filename/lineno are empty
  if (/^Script error\.?$/i.test(message.trim())) return true
  // Suspense hydration race from notification deep links (fixed client-side; suppress stale deploy noise)
  if (/Minified React error #419/i.test(message)) return true
  if (/Loading chunk .* failed/i.test(message) && /localhost/i.test(message)) return true
  if (/async Client Component/i.test(message) && /localhost/i.test(message)) return true
  return false
}

/** Monaco Editor aborts in-flight work with a bare "Canceled" rejection on unmount/navigation. */
function isBenignPromiseRejection(message: string, stack?: string): boolean {
  if (/Invalid call to runtime\.sendMessage|Tab not found/i.test(message)) return true
  if (/Could not establish connection\. Receiving end does not exist/i.test(message)) return true
  if (stack && /chrome-extension:\/\//i.test(stack)) return true
  // Safari/WebKit network blip when a fetch is aborted during navigation
  if (message.trim() === "Load failed") return true

  const trimmed = message.trim()
  const isCanceled =
    trimmed === "Canceled" ||
    /^Canceled:\s*Canceled$/i.test(trimmed) ||
    trimmed === "CanceledError"
  if (!isCanceled) return false
  if (!stack) return true
  return /monaco-editor|editor\.api|vs\/editor|@monaco-editor/i.test(stack)
}

/** Reload once after deploy when stale webpack chunks fail to load. */
export function tryAutoReloadOnChunkLoadError(message: string, errorName?: string): boolean {
  if (!isChunkLoadError(message, errorName)) return false
  try {
    if (!sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, "1")
      window.location.reload()
      return true
    }
    sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY)
  } catch {
    /* ignore storage errors */
  }
  return false
}

/** Install global window error handlers (call once on client mount) */
export function installClientErrorCapture(options?: { captureWarnings?: boolean }): () => void {
  if (typeof window === "undefined") return () => {}

  const onError = (event: ErrorEvent) => {
    const message = event.message || "Unknown error"
    if (isBenignBrowserError(message, event.error?.stack)) return
    if (tryAutoReloadOnChunkLoadError(message, event.error?.name)) return
    if (isChunkLoadError(message, event.error?.name)) return

    reportClientError({
      severity: "error",
      category: "frontend",
      title: "Uncaught JavaScript error",
      errorMessage: message,
      stackTrace: event.error?.stack,
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    })
  }

  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    const errorName = reason instanceof Error ? reason.name : undefined
    const stack = reason instanceof Error ? reason.stack : undefined
    if (isBenignBrowserError(message)) return
    if (isBenignPromiseRejection(message, stack)) return
    if (tryAutoReloadOnChunkLoadError(message, errorName)) return
    if (isChunkLoadError(message, errorName)) return

    reportClientError({
      severity: "error",
      category: "frontend",
      title: "Unhandled promise rejection",
      errorMessage: message,
      stackTrace: reason instanceof Error ? reason.stack : undefined,
      metadata: {},
    })
  }

  window.addEventListener("error", onError)
  window.addEventListener("unhandledrejection", onRejection)

  const cleanupFns: (() => void)[] = [
    () => window.removeEventListener("error", onError),
    () => window.removeEventListener("unhandledrejection", onRejection),
  ]

  if (options?.captureWarnings) {
    const origWarn = console.warn
    console.warn = (...args: unknown[]) => {
      origWarn.apply(console, args)
      const msg = args.map((a) => (typeof a === "string" ? a : String(a))).join(" ")
      if (msg.length > 10) {
        reportClientError({
          severity: "warning",
          category: "frontend",
          title: "Console warning",
          errorMessage: msg.slice(0, 2000),
        })
      }
    }
    cleanupFns.push(() => {
      console.warn = origWarn
    })
  }

  const onPageHide = () => void flushQueue()
  window.addEventListener("pagehide", onPageHide)
  cleanupFns.push(() => window.removeEventListener("pagehide", onPageHide))

  return () => cleanupFns.forEach((fn) => fn())
}

const ASSET_DEDUP_KEY = "cc_asset_failures_v1"
const MAX_ASSET_DEDUP = 200

function loadReportedAssets(): Set<string> {
  try {
    const raw = sessionStorage.getItem(ASSET_DEDUP_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function persistReportedAsset(key: string, seen: Set<string>): void {
  seen.add(key)
  try {
    const arr = [...seen].slice(-MAX_ASSET_DEDUP)
    sessionStorage.setItem(ASSET_DEDUP_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

function assetUrlFromTarget(target: EventTarget | null): string | null {
  if (!target || !(target instanceof HTMLElement)) return null
  const el = target as HTMLElement & { src?: string; href?: string; data?: string }
  const raw = el.getAttribute("src") || el.getAttribute("href") || el.getAttribute("data") || el.src || el.href || el.data
  return typeof raw === "string" && raw.trim() ? raw.trim() : null
}

function isTrackableAssetUrl(url: string): boolean {
  const u = url.toLowerCase()
  return (
    u.includes("/uploads/") ||
    u.includes("/ece2202/") ||
    u.includes("/universities/") ||
    u.includes("/api/question-media") ||
    u.includes(".public.blob.vercel-storage.com") ||
    u.includes("/recommendations/")
  )
}

/** Report a broken image/PDF/document URL to system logs (deduped per browser session). */
export function reportAssetFailure(
  assetUrl: string,
  partial?: Partial<ClientLogPayload> & { httpStatusCode?: number },
): void {
  try {
    const url = assetUrl.trim()
    if (!url || !isTrackableAssetUrl(url)) return

    const key = url.split("?")[0] ?? url
    const seen = loadReportedAssets()
    if (seen.has(key)) return
    persistReportedAsset(key, seen)

    const ctx = getClientContext()
    const route = partial?.route ?? ctx.route ?? "/"

    reportClientError({
      severity: partial?.severity ?? "error",
      category: "storage",
      title: partial?.title ?? "Uploaded asset failed to load",
      errorMessage: partial?.errorMessage ?? `Asset not found or blocked: ${key}`,
      moduleName: partial?.moduleName ?? inferModuleFromRoute(route),
      featureName: partial?.featureName ?? "Asset delivery",
      pageUrl: partial?.pageUrl ?? ctx.pageUrl,
      route,
      httpStatusCode: partial?.httpStatusCode,
      metadata: {
        assetUrl: key,
        assetType: partial?.metadata?.assetType,
        ...(partial?.metadata ?? {}),
      },
    })
  } catch {
    /* silent */
  }
}

/** Capture img/video/source/embed/object/iframe load failures globally. */
export function installAssetFailureCapture(): () => void {
  if (typeof window === "undefined") return () => {}

  const onMediaError = (event: Event) => {
    const url = assetUrlFromTarget(event.target)
    if (!url) return
    reportAssetFailure(url)
  }

  document.addEventListener("error", onMediaError, true)

  return () => {
    document.removeEventListener("error", onMediaError, true)
  }
}

/** Wrap fetch to log API failures */
export function createLoggedFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const start = Date.now()
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? "GET"

    try {
      const response = await baseFetch(input, init)
      if (response.status >= 400) {
        let responseSummary: Record<string, unknown> = { status: response.status }
        try {
          const clone = response.clone()
          const text = await clone.text()
          responseSummary.bodyPreview = text.slice(0, 500)
        } catch {
          /* ignore */
        }

        reportClientError({
          severity: response.status >= 500 ? "critical" : "error",
          category: response.status === 401 || response.status === 403 ? "authorization" : "api",
          title: `API ${response.status}`,
          errorMessage: `Request failed: ${method} ${url}`,
          apiEndpoint: url,
          httpMethod: method,
          httpStatusCode: response.status,
          executionTimeMs: Date.now() - start,
          metadata: { responseSummary },
        })
      }
      return response
    } catch (error) {
      reportClientError({
        severity: "error",
        category: "api",
        title: "Network request failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        stackTrace: error instanceof Error ? error.stack : undefined,
        apiEndpoint: url,
        httpMethod: method,
        executionTimeMs: Date.now() - start,
      })
      throw error
    }
  }
}
