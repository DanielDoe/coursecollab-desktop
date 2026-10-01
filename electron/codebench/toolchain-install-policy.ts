/** Automatic installs of the same broken toolchain were starting on every Run. */
export const PORTABLE_INSTALL_COOLDOWN_MS = 60 * 60 * 1000

export function shouldAttemptPortableInstall(
  failedAtMs: number | null,
  now: number,
  force: boolean,
  cooldownMs = PORTABLE_INSTALL_COOLDOWN_MS,
): boolean {
  if (force) return true
  if (failedAtMs == null || !Number.isFinite(failedAtMs)) return true
  return now - failedAtMs >= cooldownMs
}
