import { type NextRequest, NextResponse } from "next/server"
import { logApiError, errorToMessage } from "@/lib/system-log"

type RouteHandler = (
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> },
) => Promise<NextResponse> | NextResponse

type ApiLogOptions = {
  moduleName?: string
  getUserContext?: (request: NextRequest) => { userId?: string; userRole?: string }
}

/**
 * Wrap an API route handler to automatically log unhandled errors and HTTP error responses.
 */
export function withApiErrorLogging(handler: RouteHandler, options?: ApiLogOptions): RouteHandler {
  return async (request, context) => {
    const start = Date.now()
    try {
      const response = await handler(request, context)
      const status = response.status

      if (status >= 400) {
        let responseSummary: Record<string, unknown> = { status }
        try {
          const clone = response.clone()
          const text = await clone.text()
          responseSummary.bodyPreview = text.slice(0, 500)
        } catch {
          /* ignore */
        }

        const userCtx = options?.getUserContext?.(request) ?? {}
        void logApiError(request, `HTTP ${status}`, {
          statusCode: status,
          moduleName: options?.moduleName ?? "Platform Module",
          userId: userCtx.userId,
          userRole: userCtx.userRole,
          responseSummary,
          executionTimeMs: Date.now() - start,
        })
      }

      return response
    } catch (error) {
      const userCtx = options?.getUserContext?.(request) ?? {}
      void logApiError(request, error, {
        statusCode: 500,
        moduleName: options?.moduleName ?? "Platform Module",
        userId: userCtx.userId,
        userRole: userCtx.userRole,
        executionTimeMs: Date.now() - start,
        responseSummary: { message: errorToMessage(error) },
      })
      throw error
    }
  }
}
