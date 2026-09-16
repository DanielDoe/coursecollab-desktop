import { isDesktopAppShell } from "@/lib/desktop-auth-policy"

/**
 * CourseCollab desktop (Electron) assessment integrity model:
 *
 * - No browser tabs or in-browser Gemini/Copilot side panels → disable `trackGeminiWindow`.
 * - Leaving the app (Cmd+Tab, another window, minimize) → `trackTabSwitches` / visibility API.
 * - Native lock → Electron kiosk (dev + production): no menu, no minimize, refocus watchdog, DevTools blocked.
 * - Renderer fullscreen runs in parallel and is reasserted every 2s during the attempt.
 * - Copy/paste, strict mode, devtools shortcuts → renderer hooks + main-process input guard.
 * - Leaving the app → visibility with ~750ms grace (ignores brief Spotlight/menu flashes).
 * - Answer locking matches the web app: only submitted/finalized answers lock (not navigation or preview).
 * - Electron denies popup windows; external URLs open in the system browser.
 *
 * First-run CodeBench setup is the only intentional second BrowserWindow.
 */

export function isDesktopElectronAssessmentClient(): boolean {
  return isDesktopAppShell()
}

export function applyDesktopElectronAntiCheatPolicy<
  T extends {
    trackGeminiWindow?: boolean
    requireFullscreen?: boolean
    trackTabSwitches?: boolean
    strictModeEnabled?: boolean
  },
>(config: T): T {
  if (!isDesktopElectronAssessmentClient()) return config

  const enforcementActive =
    config.strictModeEnabled === true ||
    config.requireFullscreen === true ||
    config.trackTabSwitches === true

  return {
    ...config,
    trackGeminiWindow: false,
    // App-switch detection replaces browser tab switches on desktop.
    ...(enforcementActive ? { trackTabSwitches: true as const } : {}),
  }
}

/** Grace before counting a leave event (Spotlight, menu bar). */
export const DESKTOP_ASSESSMENT_LEAVE_GRACE_MS = 750

export function assessmentLeaveViolationDetail(): string {
  return isDesktopElectronAssessmentClient()
    ? "User switched away from the CourseCollab application"
    : "User switched away from assessment tab"
}

export function assessmentLeaveWarningMessage(): string {
  return isDesktopElectronAssessmentClient()
    ? "⚠️ Warning: You left the assessment window (for example, another app or desktop). This action has been logged."
    : "⚠️ Warning: You have switched away from the assessment tab. This action has been logged."
}
