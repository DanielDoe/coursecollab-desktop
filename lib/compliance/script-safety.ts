import { isProductionRuntime } from "@/lib/compliance/environment"

export function assertDestructiveScriptAllowed(
  env: NodeJS.ProcessEnv = process.env,
  label = "destructive script",
): void {
  if (env.ALLOW_PRODUCTION_DESTRUCTIVE === "1") return
  if (isProductionRuntime(env) || env.CC_PROTECT_PRODUCTION_DB === "1") {
    throw new Error(
      `Refusing to run ${label} against a production-protected database. Set ALLOW_PRODUCTION_DESTRUCTIVE=1 only for an intentional, reviewed operation.`,
    )
  }
}

export function isLikelyProductionDatabaseUrl(url: string): boolean {
  const value = String(url ?? "")
  if (!value) return false
  if (/localhost|127\.0\.0\.1/i.test(value)) return false
  return /neon\.tech/i.test(value) && /prod|production|course-collab/i.test(value)
}
