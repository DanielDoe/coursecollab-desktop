import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { detectCppCompiler, firstDetectedCppCompiler, macDeveloperToolsPresent } from './compilerDetector'
import { CODEBENCH_LIMITS } from './limits'
import { installPortableToolchainOnce } from './toolchain-install'
import { shouldAttemptPortableInstall } from './toolchain-install-policy'
import { portableToolchainForHost } from './toolchain-manifest'
import { emitToolchainProgress } from './toolchain-progress'
import { userToolchainRoot } from './toolchain-paths'
import { verifyCppToolchain } from './toolchain-verify'
import {
  clearToolchainVerifyCache,
  isToolchainVerifyCacheValid,
  writeToolchainVerifyCache,
} from './toolchain-verify-cache'
import type { CompilerInfo } from './types'

export type EnsureCppToolchainMode = 'startup' | 'full'

type InstallFailureRecord = {
  failedAt: string
  detail: string
}

const INSTALL_FAILURE_FILE = 'install-failed.json'

function offerMacCommandLineTools(): void {
  if (process.platform !== 'darwin') return
  emitToolchainProgress({
    phase: 'prompting-system',
    message: 'If Apple asks, you can also install Command Line Tools.',
  })
  const child = spawn('xcode-select', ['--install'], {
    shell: false,
    windowsHide: true,
    stdio: 'ignore',
    detached: true,
  })
  child.unref()
}

function withInstallFlag(info: CompilerInfo, extras?: Partial<CompilerInfo>): CompilerInfo {
  return {
    ...info,
    canInstall: extras?.canInstall ?? Boolean(portableToolchainForHost()),
    installing: extras?.installing ?? false,
    installProgress: extras?.installProgress,
    installMessage: extras?.installMessage,
  }
}

function unavailable(message: string): CompilerInfo {
  return withInstallFlag(
    {
      available: false,
      compiler: null,
      path: null,
      version: null,
      platform: process.platform,
      architecture: process.arch,
      setupGuidance: message,
      source: null,
    },
    { canInstall: true },
  )
}

function installFailurePath(): string {
  return join(userToolchainRoot(), INSTALL_FAILURE_FILE)
}

async function readInstallFailure(): Promise<InstallFailureRecord | null> {
  const path = installFailurePath()
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as InstallFailureRecord
    if (typeof parsed.failedAt !== 'string' || typeof parsed.detail !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

async function writeInstallFailure(detail: string): Promise<void> {
  const root = userToolchainRoot()
  await mkdir(root, { recursive: true })
  const record: InstallFailureRecord = { failedAt: new Date().toISOString(), detail }
  await writeFile(installFailurePath(), JSON.stringify(record), 'utf8')
}

async function clearInstallFailure(): Promise<void> {
  await rm(installFailurePath(), { force: true }).catch(() => undefined)
}

let ensureLock: Promise<CompilerInfo> | null = null

async function acceptVerifiedCompiler(found: CompilerInfo, notify: boolean): Promise<CompilerInfo> {
  await writeToolchainVerifyCache(found)
  await clearInstallFailure()
  if (notify) {
    emitToolchainProgress({ phase: 'ready', message: 'C++ compiler ready.', percent: 100 })
  }
  return withInstallFlag(found, { canInstall: false })
}

function explainTestCompileFailure(detail: string): string {
  const body = detail.trim() || 'The compiler did not print an error.'
  if (/unknown architecture/i.test(body)) {
    return [
      'The compiler downloaded, then the test compile failed on this Mac. The system library list names a CPU type this compiler cannot read (unknown architecture, from libSystem.tbd).',
      body,
    ].join('\n')
  }
  return ['The compiler downloaded, then the test compile failed on this computer.', body].join('\n')
}

function timeoutFor(info: CompilerInfo): number {
  return info.source === 'app-managed' || info.source === 'bundled'
    ? CODEBENCH_LIMITS.verifyCompileTimeoutMs
    : CODEBENCH_LIMITS.systemVerifyTimeoutMs
}

async function verifyOrUseCache(
  found: CompilerInfo,
  notify: boolean,
): Promise<CompilerInfo | { failed: string }> {
  if (await isToolchainVerifyCacheValid(found)) {
    await clearInstallFailure()
    return withInstallFlag(found, { canInstall: false })
  }
  const result = await verifyCppToolchain(found, timeoutFor(found))
  if (result.ok) return acceptVerifiedCompiler(found, notify)
  const where = [found.compiler, found.path].filter(Boolean).join(' at ')
  return {
    failed: `${where || 'The C++ compiler'} failed a test compile:\n${result.detail || 'No compiler output.'}`,
  }
}

/**
 * Prefer a compiler that can compile. System tools are tried before the copy
 * CourseCollab downloaded, because a broken download used to win on --version
 * alone and then get deleted and fetched again on every Run.
 */
async function selectVerifiedCompiler(notify: boolean): Promise<{ info: CompilerInfo | null; detail: string }> {
  let detail = ''
  let chosen: CompilerInfo | null = null
  await firstDetectedCppCompiler('all', async (info) => {
    const verified = await verifyOrUseCache(info, notify)
    if ('failed' in verified) {
      detail = verified.failed
      return false
    }
    chosen = verified
    return true
  })
  return { info: chosen, detail }
}

export async function ensureCppToolchain(options?: {
  installIfMissing?: boolean
  mode?: EnsureCppToolchainMode
  forceInstall?: boolean
}): Promise<CompilerInfo> {
  const mode = options?.mode ?? 'full'
  const notify = mode !== 'startup'
  const forceInstall = options?.forceInstall === true
  if (ensureLock) return ensureLock
  ensureLock = (async () => {
    const cached = await firstDetectedCppCompiler('all', (info) => isToolchainVerifyCacheValid(info))
    if (cached) {
      await clearInstallFailure()
      if (notify) {
        emitToolchainProgress({ phase: 'ready', message: 'C++ compiler ready.', percent: 100 })
      }
      return withInstallFlag(cached, { canInstall: false })
    }

    const previous = await readInstallFailure()
    const failedAt = previous ? Date.parse(previous.failedAt) : null
    const coolingDown = !shouldAttemptPortableInstall(
      Number.isFinite(failedAt) ? failedAt : null,
      Date.now(),
      forceInstall,
    )
    if (coolingDown) {
      return unavailable(
        previous?.detail || 'Could not install a C++ compiler on this computer.',
      )
    }

    const verified = await selectVerifiedCompiler(notify)
    if (verified.info) return verified.info

    if (options?.installIfMissing === false || process.env.CODEBENCH_SKIP_TOOLCHAIN_INSTALL === '1') {
      return withInstallFlag(await detectCppCompiler())
    }

    const artifact = portableToolchainForHost()
    if (!artifact) {
      const message = verified.detail || setupGuidanceFallback()
      if (notify) emitToolchainProgress({ phase: 'failed', message })
      return unavailable(message)
    }

    if (notify) {
      emitToolchainProgress({ phase: 'searching', message: 'Looking for a C++ compiler…' })
    }
    if (!macDeveloperToolsPresent()) offerMacCommandLineTools()
    const managed = await detectCppCompiler({ scope: 'managed' })
    try {
      if (forceInstall) await clearToolchainVerifyCache()
      await installPortableToolchainOnce({ replace: forceInstall && managed.available })
      if (notify) {
        emitToolchainProgress({ phase: 'verifying', message: 'Checking the C++ compiler…', percent: 100 })
      }
      const afterInstall = await selectVerifiedCompiler(notify)
      if (!afterInstall.info) {
        const why = afterInstall.detail || verified.detail
        throw new Error(explainTestCompileFailure(why))
      }
      return afterInstall.info
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not install a C++ compiler.'
      const guidance = message
      await writeInstallFailure(guidance).catch(() => undefined)
      if (notify) emitToolchainProgress({ phase: 'failed', message: guidance })
      return unavailable(guidance)
    }
  })().finally(() => {
    ensureLock = null
  })
  return ensureLock
}

function setupGuidanceFallback(): string {
  if (process.platform === 'darwin') {
    return 'CourseCollab can install a C++ compiler for this computer. You can also install Apple Command Line Tools.'
  }
  if (process.platform === 'win32') {
    return 'CourseCollab can install MinGW-w64 (g++) for this computer. You can also install LLVM or MinGW yourself.'
  }
  return 'CourseCollab can install a C++ compiler for this computer. You can also install g++ or clang++ yourself.'
}
