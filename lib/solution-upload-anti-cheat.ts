/** Grace period after upload/picker completes before re-enabling strict anti-cheat. */
export const SOLUTION_UPLOAD_ANTICHEAT_GRACE_MS = 6000

/**
 * Suspend tab/Gemini anti-cheat for solution upload flow.
 * Caller must invoke the returned function when the picker is cancelled or upload finishes.
 */
export function beginSolutionUploadAntiCheatSuspension(
  onSuspendedChange?: (suspended: boolean) => void,
): () => void {
  if (!onSuspendedChange) return () => {}

  onSuspendedChange(true)
  let finished = false

  return () => {
    if (finished) return
    finished = true
    window.setTimeout(() => onSuspendedChange(false), SOLUTION_UPLOAD_ANTICHEAT_GRACE_MS)
  }
}
