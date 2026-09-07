import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveRuntimeEnvironment } from "@/lib/compliance/environment"
import { publicErrorMessage } from "@/lib/compliance/safe-error"

export const runtime = "nodejs"
export const revalidate = 0
export const dynamic = "force-dynamic"

export async function GET() {
  const started = Date.now()
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { status: "error", message: "Service unavailable", timestamp: new Date().toISOString() },
        { status: 503 },
      )
    }

    await sql`SELECT 1 as health_check`
    return NextResponse.json({
      status: "ok",
      database: "connected",
      environment: resolveRuntimeEnvironment(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown",
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Health] check failed:", publicErrorMessage(error, "database unreachable"))
    return NextResponse.json(
      {
        status: "error",
        message: "Service unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}
