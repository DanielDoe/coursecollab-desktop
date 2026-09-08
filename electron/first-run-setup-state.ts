/** Bump this to invalidate leftover or accidentally shipped completion files. */
export const SETUP_VERSION = 3

export type SetupState = {
  version: number
  completedAt: string
  platform: NodeJS.Platform
  arch: string
  /** Unique id for this install. Must match the current installer stamp. */
  installId: string
}

export type SetupGateContext = {
  isPackaged: boolean
  skipEnv?: string
  forceEnv?: string
  previewEnv?: string
  resetSwitch?: boolean
  setupComplete: boolean
}

export function isUsableSetupState(
  value: unknown,
  current: { platform: string; arch: string; installId: string },
): value is SetupState {
  if (!value || typeof value !== 'object') return false
  const parsed = value as Partial<SetupState>
  if (parsed.version !== SETUP_VERSION) return false
  if (typeof parsed.completedAt !== 'string' || !parsed.completedAt) return false
  if (typeof parsed.platform !== 'string' || typeof parsed.arch !== 'string') return false
  if (typeof parsed.installId !== 'string' || !parsed.installId) return false
  if (parsed.platform !== current.platform || parsed.arch !== current.arch) return false
  return parsed.installId === current.installId
}

/**
 * Packaged builds always show setup once per install.
 * CC_SKIP_SETUP is a local-dev escape hatch only — never honor it in shipped apps.
 */
export function shouldShowFirstRunSetup(ctx: SetupGateContext): boolean {
  if (ctx.forceEnv === '1' || ctx.resetSwitch) return true
  if (!ctx.isPackaged && ctx.previewEnv !== '1') return false
  if (!ctx.isPackaged && ctx.skipEnv === '1') return false
  return !ctx.setupComplete
}
