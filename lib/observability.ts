/**
 * Observability Logging Utility
 * 
 * Provides a lightweight, non-blocking logging system for tracking
 * student behaviors and system events across the CourseCollab platform.
 * 
 * Usage:
 *   import { logEvent, logBatch } from "@/lib/observability"
 *   
 *   logEvent("quiz", "question", "ANSWER_SELECT", {
 *     quizId: 123,
 *     questionId: 456,
 *     selectedOption: "A"
 *   })
 */

interface LogEvent {
  module: string
  subModule?: string
  eventType: string
  eventData?: Record<string, any>
  status?: "success" | "warning" | "error" | "info"
  sessionId?: string
}

// Observability toggle - can be controlled via environment variable or runtime
let observabilityEnabled = true

// Check environment variable on initialization
if (typeof window === 'undefined') {
  // Server-side: check environment variable
  observabilityEnabled = process.env.NEXT_PUBLIC_OBSERVABILITY_ENABLED !== 'false'
} else {
  // Client-side: check environment variable
  observabilityEnabled = process.env.NEXT_PUBLIC_OBSERVABILITY_ENABLED !== 'false'
}

// Function to check if observability is enabled
export function isObservabilityEnabled(): boolean {
  // Check localStorage for runtime toggle (instructor can enable/disable)
  if (typeof window !== 'undefined') {
    const runtimeToggle = localStorage.getItem('observability_enabled')
    if (runtimeToggle !== null) {
      return runtimeToggle === 'true'
    }
  }
  return observabilityEnabled
}

// Function to enable/disable observability at runtime
export function setObservabilityEnabled(enabled: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('observability_enabled', enabled.toString())
    console.log(`[Observability] ${enabled ? 'Enabled' : 'Disabled'}`)
  }
}

// Generate a unique session ID for grouping related events
let currentSessionId: string | null = null

export function getSessionId(): string {
  if (!currentSessionId) {
    currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  return currentSessionId
}

export function resetSessionId(): void {
  currentSessionId = null
}

// Queue for batch logging
let logQueue: LogEvent[] = []
let batchTimer: NodeJS.Timeout | null = null
const BATCH_INTERVAL = 5000 // Send logs every 5 seconds
const MAX_BATCH_SIZE = 50 // Or when queue reaches 50 events

/**
 * Log a single event (fire-and-forget)
 * Never throws errors or blocks execution
 */
export async function logEvent(
  module: string,
  subModule: string | undefined,
  eventType: string,
  eventData?: Record<string, any>,
  status: "success" | "warning" | "error" | "info" = "info"
): Promise<void> {
  // Early return if observability is disabled
  if (!isObservabilityEnabled()) {
    return
  }
  
  try {
    // Add user ID from session storage if available
    // Prefer studentDatabaseId (database ID) over studentId (string identifier)
    const studentDatabaseId = typeof window !== "undefined" 
      ? sessionStorage.getItem("studentDatabaseId")
      : null
    const studentId = typeof window !== "undefined"
      ? sessionStorage.getItem("studentId")
      : null

    const payload: LogEvent = {
      module,
      subModule,
      eventType,
      eventData: {
        ...eventData,
        studentDatabaseId: studentDatabaseId || undefined,
        studentId: studentId || undefined,
        timestamp: Date.now(),
        url: typeof window !== "undefined" ? window.location.href : undefined
      },
      status,
      sessionId: getSessionId()
    }

    // Fire-and-forget POST request
    fetch("/api/observability/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Don't wait for response
      keepalive: true
    }).catch(() => {
      // Silent fail - observability should never break the app
      if (process.env.NODE_ENV === "development") {
        console.warn("[Observability] Failed to log event:", eventType)
      }
    })
  } catch (error) {
    // Silent fail
    if (process.env.NODE_ENV === "development") {
      console.warn("[Observability] Error in logEvent:", error)
    }
  }
}

/**
 * Add event to batch queue for efficient logging
 */
export function queueEvent(
  module: string,
  subModule: string | undefined,
  eventType: string,
  eventData?: Record<string, any>,
  status: "success" | "warning" | "error" | "info" = "info"
): void {
  // Early return if observability is disabled
  if (!isObservabilityEnabled()) {
    return
  }
  
  try {
    const studentDatabaseId = typeof window !== "undefined" 
      ? sessionStorage.getItem("studentDatabaseId")
      : null
    const studentId = typeof window !== "undefined"
      ? sessionStorage.getItem("studentId")
      : null

    logQueue.push({
      module,
      subModule,
      eventType,
      eventData: {
        ...eventData,
        studentDatabaseId: studentDatabaseId || undefined,
        studentId: studentId || undefined,
        timestamp: Date.now(),
        url: typeof window !== "undefined" ? window.location.href : undefined
      },
      status,
      sessionId: getSessionId()
    })

    // Send batch if queue is full
    if (logQueue.length >= MAX_BATCH_SIZE) {
      flushLogs()
    } else if (!batchTimer) {
      // Start batch timer if not already running
      batchTimer = setTimeout(flushLogs, BATCH_INTERVAL)
    }
  } catch (error) {
    // Silent fail
    if (process.env.NODE_ENV === "development") {
      console.warn("[Observability] Error queuing event:", error)
    }
  }
}

/**
 * Flush queued logs to server
 */
export function flushLogs(): void {
  if (logQueue.length === 0) return

  try {
    const logsToSend = [...logQueue]
    logQueue = []

    if (batchTimer) {
      clearTimeout(batchTimer)
      batchTimer = null
    }

    // Send batch
    fetch("/api/observability/log", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logs: logsToSend }),
      keepalive: true
    }).catch(() => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Observability] Failed to send batch logs")
      }
    })
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Observability] Error flushing logs:", error)
    }
  }
}

/**
 * Log batch of events at once
 */
export async function logBatch(events: Array<{
  module: string
  subModule?: string
  eventType: string
  eventData?: Record<string, any>
  status?: "success" | "warning" | "error" | "info"
}>): Promise<void> {
  try {
    const studentDatabaseId = typeof window !== "undefined" 
      ? sessionStorage.getItem("studentDatabaseId")
      : null
    const studentId = typeof window !== "undefined"
      ? sessionStorage.getItem("studentId")
      : null

    const sessionId = getSessionId()

    const logs = events.map(event => ({
      ...event,
      eventData: {
        ...event.eventData,
        studentDatabaseId: studentDatabaseId || undefined,
        studentId: studentId || undefined,
        timestamp: Date.now(),
        url: typeof window !== "undefined" ? window.location.href : undefined
      },
      sessionId
    }))

    fetch("/api/observability/log", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logs }),
      keepalive: true
    }).catch(() => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Observability] Failed to send batch")
      }
    })
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Observability] Error in logBatch:", error)
    }
  }
}

/**
 * Utility to measure and log performance
 */
export function logPerformance(
  module: string,
  subModule: string,
  operation: string,
  startTime: number,
  additionalData?: Record<string, any>
): void {
  const duration = Date.now() - startTime
  logEvent(module, subModule, "PERFORMANCE", {
    operation,
    duration,
    ...additionalData
  }, duration > 3000 ? "warning" : "info")
}

/**
 * Utility to log errors with context
 */
export function logError(
  module: string,
  subModule: string,
  error: Error | string,
  context?: Record<string, any>
): void {
  logEvent(module, subModule, "ERROR", {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    ...context
  }, "error")
}

// Flush logs before page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    flushLogs()
  })
}

