export type ToolchainSetupPhase =
  | 'searching'
  | 'prompting-system'
  | 'downloading'
  | 'extracting'
  | 'verifying'
  | 'ready'
  | 'failed'

export type ToolchainSetupOutcome = 'active' | 'success' | 'error' | 'hidden'

export const TOOLCHAIN_SETUP_STEPS: {
  phase: ToolchainSetupPhase
  title: string
  detail: string
}[] = [
  {
    phase: 'searching',
    title: 'Scanning your computer',
    detail: 'Checking for g++, clang++, or a previous CourseCollab install',
  },
  {
    phase: 'prompting-system',
    title: 'System tools (if needed)',
    detail: 'Apple may ask to install Command Line Tools — you can approve or skip',
  },
  {
    phase: 'downloading',
    title: 'Downloading compiler',
    detail: 'Fetching MinGW-w64 (g++) or our portable toolchain — keep CourseCollab open',
  },
  {
    phase: 'extracting',
    title: 'Installing files',
    detail: 'Unpacking into your private CourseCollab folder on this device',
  },
  {
    phase: 'verifying',
    title: 'Running a test compile',
    detail: 'Building a tiny program so your first assignment run is fast',
  },
]

export function toolchainStepIndex(phase: ToolchainSetupPhase | null): number {
  if (!phase) return 0
  const idx = TOOLCHAIN_SETUP_STEPS.findIndex((step) => step.phase === phase)
  if (idx >= 0) return idx
  if (phase === 'ready') return TOOLCHAIN_SETUP_STEPS.length
  return 0
}

export function toolchainOverallPercent(
  phase: ToolchainSetupPhase | null,
  downloadPercent: number | null,
): number {
  const total = TOOLCHAIN_SETUP_STEPS.length
  if (phase === 'ready') return 100
  if (phase === 'failed') return 0
  const idx = toolchainStepIndex(phase)
  if (phase === 'downloading' && downloadPercent != null) {
    const slice = 100 / total
    const base = idx * slice
    return Math.min(99, Math.round(base + (downloadPercent / 100) * slice))
  }
  return Math.min(95, Math.round(((idx + 0.4) / total) * 100))
}
