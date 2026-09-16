import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { binDirForCompiler, prependPath, userToolchainRoot } from './toolchain-paths'
import type { CompilerFamily } from './types'

/** Keys copied into CodeBench child processes (Electron often strips the rest). */
const PASSTHROUGH_KEYS = [
  'PATH',
  'Path',
  'HOME',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'APPDATA',
  'LOCALAPPDATA',
  'PROGRAMDATA',
  'PUBLIC',
  'TMPDIR',
  'TMP',
  'TEMP',
  'LANG',
  'LC_ALL',
  'SDKROOT',
  'DEVELOPER_DIR',
  'INCLUDE',
  'LIB',
  'LIBPATH',
  'SystemRoot',
  'SYSTEMROOT',
  'WINDIR',
  'USER',
  'USERNAME',
  'TERM',
  'COLORTERM',
] as const

export function applyWindowsAppDataFallbacks(env: NodeJS.ProcessEnv): void {
  if (process.platform !== 'win32') return
  const profile = env.USERPROFILE?.trim() || homedir()
  if (!profile) return
  if (!env.LOCALAPPDATA?.trim()) {
    env.LOCALAPPDATA = join(profile, 'AppData', 'Local')
  }
  if (!env.APPDATA?.trim()) {
    env.APPDATA = join(profile, 'AppData', 'Roaming')
  }
}

function pickProcessEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const key of PASSTHROUGH_KEYS) {
    const value = process.env[key]
    if (value != null && value !== '') env[key] = value
  }
  applyWindowsAppDataFallbacks(env)
  return env
}

/** Writable Zig caches under CourseCollab userData — avoids AppDataDirUnavailable when LOCALAPPDATA is missing. */
export function ensureZigCacheEnv(env: NodeJS.ProcessEnv): void {
  const root = join(userToolchainRoot(), 'zig-cache')
  const globalDir = join(root, 'global')
  const localDir = join(root, 'local')
  mkdirSync(globalDir, { recursive: true })
  mkdirSync(localDir, { recursive: true })
  env.ZIG_GLOBAL_CACHE_DIR = globalDir
  env.ZIG_LOCAL_CACHE_DIR = localDir
}

export type CodebenchChildEnvOptions = {
  pathPrefix?: string | null
  useZigCache?: boolean
}

export function buildCodebenchChildEnv(options: CodebenchChildEnvOptions = {}): NodeJS.ProcessEnv {
  const env = pickProcessEnv()
  if (!env.LANG) env.LANG = 'en_US.UTF-8'
  if (options.useZigCache) ensureZigCacheEnv(env)
  return prependPath(env, options.pathPrefix)
}

export function buildCompilerChildEnv(
  compilerPath: string | null | undefined,
  compiler: CompilerFamily | null | undefined,
): NodeJS.ProcessEnv {
  return buildCodebenchChildEnv({
    pathPrefix: binDirForCompiler(compilerPath),
    useZigCache: compiler === 'zig',
  })
}
