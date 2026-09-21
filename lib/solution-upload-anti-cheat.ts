/** Grace period after upload/picker completes before re-enabling strict anti-cheat. */
export const SOLUTION_UPLOAD_ANTICHEAT_GRACE_MS = 6000

/**
 * Hard cap on how long the solution-upload flow may suspend anti-cheat.
 * SECURITY: without this, leaving the file picker/camera open paused all
 * detection indefinitely — a free cheating window. After the cap elapses the
 * suspension auto-expires even if the picker is still open.
 */
export const MAX_SOLUTION_UPLOAD_SUSPENSION_MS = 90_000

/**
 * Suspend tab/Gemini anti-cheat for solution upload flow.
 * Caller must invoke the returned function when the picker is cancelled or upload finishes.
 *
 * The suspension auto-expires after MAX_SOLUTION_UPLOAD_SUSPENSION_MS: the start
 * timestamp is recorded and `onSuspendedChange(false)` is reported once the cap
 * elapses, so every consumer gets the cap for free.
 */
export function beginSolutionUploadAntiCheatSuspension(
  onSuspendedChange?: (suspended: boolean) => void,
): () => void {
  if (!onSuspendedChange) return () => {}

  const suspendedAt = Date.now()
  onSuspendedChange(true)
  let finished = false

  // Hard cap: report the pause as over even if the picker stays open.
  const capTimer = window.setTimeout(() => {
    if (finished) return
    finished = true
    onSuspendedChange(false)
  }, MAX_SOLUTION_UPLOAD_SUSPENSION_MS)

  return () => {
    if (finished) return
    finished = true
    window.clearTimeout(capTimer)
    if (Date.now() - suspendedAt >= MAX_SOLUTION_UPLOAD_SUSPENSION_MS) {
      // Cap already elapsed (e.g. throttled timer) — end immediately, no grace.
      onSuspendedChange(false)
      return
    }
    window.setTimeout(() => onSuspendedChange(false), SOLUTION_UPLOAD_ANTICHEAT_GRACE_MS)
  }
}
