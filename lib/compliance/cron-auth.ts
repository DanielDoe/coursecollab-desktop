import { type NextRequest, NextResponse } from "next/server"
import { isProductionRuntime } from "@/lib/compliance/environment"

export function requireCronAuth(
  request: NextRequest | Request,
  env: NodeJS.ProcessEnv = process.env,
): { ok: true } | { ok: false; response: NextResponse } {
  const secret = String(env.CRON_SECRET ?? "").trim()
  const auth = request.headers.get("authorization") ?? ""

  if (!secret) {
    if (isProductionRuntime(env)) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }
    }
    return { ok: true }
  }

  if (auth !== `Bearer ${secret}`) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  return { ok: true }
}
