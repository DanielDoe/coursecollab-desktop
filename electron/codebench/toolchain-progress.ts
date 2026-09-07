export type ToolchainInstallPhase =
  | 'searching'
  | 'prompting-system'
  | 'downloading'
  | 'extracting'
  | 'verifying'
  | 'ready'
  | 'failed'

export type ToolchainProgress = {
  phase: ToolchainInstallPhase
  message: string
  percent?: number
}

type Listener = (progress: ToolchainProgress) => void

const listeners = new Set<Listener>()

export function onToolchainProgress(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitToolchainProgress(progress: ToolchainProgress): void {
  for (const listener of listeners) {
    try {
      listener(progress)
    } catch {
      // ignore subscriber errors
    }
  }
}
