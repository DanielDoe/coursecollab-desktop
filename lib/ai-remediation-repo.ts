import { existsSync } from "fs"
import { resolve } from "path"

/** Matches expo/src/lib/system-log-client.ts — mobile native app errors. */
export const MOBILE_APP_PLATFORM = "mobile-app" as const

export type RemediationDeployStrategy = "vercel" | "expo-ota"

export type RemediationRepoTarget = {
  platform: "web" | typeof MOBILE_APP_PLATFORM
  repoRoot: string
  validationChecks: Array<[string, string]>
  deployStrategy: RemediationDeployStrategy
}

type LogSample = {
  metadata?: Record<string, unknown>
}

export function isMobileAppLogSample(log: LogSample): boolean {
  return log.metadata?.platform === MOBILE_APP_PLATFORM
}

export function isMobileAppLogGroup(logs: LogSample[]): boolean {
  return logs.some(isMobileAppLogSample)
}

function defaultMobileRepoRoot(): string {
  const configured = process.env.REMEDIATION_MOBILE_REPO_ROOT?.trim()
  if (configured) return resolve(configured)
  const sibling = resolve(process.cwd(), "../course-collab-mobile")
  if (existsSync(resolve(sibling, "expo/package.json"))) return sibling
  return sibling
}

function defaultWebRepoRoot(): string {
  return resolve(process.env.REMEDIATION_REPO_ROOT?.trim() || process.cwd())
}

export function resolveRemediationRepoTarget(logs: LogSample[]): RemediationRepoTarget {
  if (isMobileAppLogGroup(logs)) {
    return {
      platform: MOBILE_APP_PLATFORM,
      repoRoot: defaultMobileRepoRoot(),
      validationChecks: [["typecheck", "cd expo && npx tsc --noEmit"]],
      deployStrategy: "expo-ota",
    }
  }

  return {
    platform: "web",
    repoRoot: defaultWebRepoRoot(),
    validationChecks: [
      ["lint", "npm run lint"],
      ["typecheck", "npm run typecheck"],
      ["test", "npm run test -- --passWithNoTests"],
      ["build", "npm run build"],
    ],
    deployStrategy: "vercel",
  }
}

export function mobileRemediationNotes(): string {
  return [
    "Mobile app fix merged — publish JavaScript via EAS Update:",
    "  cd expo && eas update --branch production --message \"fix: system-log group\"",
    "Native shell changes still require App Store / Play Store submission.",
  ].join("\n")
}
