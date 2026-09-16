import type { AntiCheatConfig } from "@/hooks/use-anti-cheat"
import { isDesktopElectronAssessmentClient } from "@/lib/desktop-anticheat-policy"

export function isDesktopNativeAssessmentLockdownActive(input: {
  disabledForTesting: boolean
  quizStarted: boolean
  loading: boolean
  antiCheatEnabled: boolean
  config: Pick<
    AntiCheatConfig,
    | "strictModeEnabled"
    | "trackTabSwitches"
    | "requireFullscreen"
    | "blockCopyPaste"
    | "suspended"
  >
}): boolean {
  if (!isDesktopElectronAssessmentClient()) return false
  if (input.disabledForTesting || !input.quizStarted || input.loading) return false
  if (!input.antiCheatEnabled || input.config.suspended) return false

  // Any enforced desktop proctoring flag → native kiosk for the attempt.
  return (
    input.config.strictModeEnabled === true ||
    input.config.trackTabSwitches === true ||
    input.config.requireFullscreen === true ||
    input.config.blockCopyPaste === true
  )
}
