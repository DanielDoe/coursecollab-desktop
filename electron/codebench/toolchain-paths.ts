import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'

export const TOOLCHAIN_MARKER = 'READY'

export function userToolchainRoot(): string {
  try {
    // Lazy require so the Vite localhost bridge can reuse this file.
    const electron = require('electron') as {
      app?: { isReady: () => boolean; getPath: (name: string) => string }
    }
    if (electron.app?.isReady?.()) {
      return join(electron.app.getPath('userData'), 'codebench-toolchain')
    }
  } catch {
    // not running inside Electron
  }
  return join(homedir(), '.coursecollab', 'codebench-toolchain')
}

export function bundledToolchainRoot(): string | null {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  if (!resourcesPath) return null
  const dir = join(resourcesPath, 'codebench-toolchain')
  return existsSync(dir) ? dir : null
}

export function managedBinHints(): string[] {
  const roots = [userToolchainRoot(), bundledToolchainRoot()].filter((dir): dir is string => Boolean(dir))
  const dirs: string[] = []
  for (const root of roots) {
    dirs.push(root, join(root, 'bin'))
    if (process.platform === 'win32') {
      dirs.push(join(root, 'current'), join(root, 'current', 'bin'))
    } else {
      dirs.push(join(root, 'current'), join(root, 'current', 'bin'))
    }
  }
  return dirs
}

export function prependPath(env: NodeJS.ProcessEnv, binDir: string | null | undefined): NodeJS.ProcessEnv {
  if (!binDir) return env
  const current = env.PATH ?? env.Path ?? ''
  const next = current ? `${binDir}${delimiter}${current}` : binDir
  return { ...env, PATH: next, Path: next }
}

export function binDirForCompiler(compilerPath: string | null | undefined): string | null {
  if (!compilerPath) return null
  return dirname(compilerPath)
}
