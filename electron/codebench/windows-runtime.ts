import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/** MinGW programs look for these beside program.exe before they look on PATH. */
const RUNTIME_DLLS = [
  'libstdc++-6.dll',
  'libgcc_s_seh-1.dll',
  'libgcc_s_dw2-1.dll',
  'libwinpthread-1.dll',
]

export function stageWindowsCompilerRuntime(binDir: string | null | undefined, workspaceDir: string): void {
  if (process.platform !== 'win32' || !binDir) return
  for (const name of RUNTIME_DLLS) {
    const from = join(binDir, name)
    if (!existsSync(from)) continue
    try {
      copyFileSync(from, join(workspaceDir, name))
    } catch {
      /* PATH still includes the compiler directory */
    }
  }
}
