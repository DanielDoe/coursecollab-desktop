import { spawn } from 'node:child_process'
import { detectCppCompiler } from './compilerDetector'
import { installPortableToolchainOnce, isManagedToolchainInstalled } from './toolchain-install'
import { portableToolchainForHost } from './toolchain-manifest'
import { emitToolchainProgress } from './toolchain-progress'
import { verifyCppToolchain } from './toolchain-verify'
import {
  isToolchainVerifyCacheValid,
  writeToolchainVerifyCache,
} from './toolchain-verify-cache'
import type { CompilerInfo } from './types'

export type EnsureCppToolchainMode = 'startup' | 'full'

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

function isStaleManagedCompiler(info: CompilerInfo): boolean {
  const artifact = portableToolchainForHost()
  if (!artifact || info.source !== 'app-managed') return false
  return !isManagedToolchainInstalled(artifact)
}

let ensureLock: Promise<CompilerInfo> | null = null

async function acceptVerifiedCompiler(found: CompilerInfo): Promise<CompilerInfo> {
  await writeToolchainVerifyCache(found)
  emitToolchainProgress({ phase: 'ready', message: 'C++ compiler ready.', percent: 100 })
  return withInstallFlag(found, { canInstall: false })
}

async function verifyOrUseCache(found: CompilerInfo, emitSearching: boolean): Promise<CompilerInfo | 'retry-install'> {
  if (await isToolchainVerifyCacheValid(found)) {
    emitToolchainProgress({ phase: 'ready', message: 'C++ compiler ready.', percent: 100 })
    return withInstallFlag(found, { canInstall: false })
  }
  if (emitSearching) {
    emitToolchainProgress({ phase: 'verifying', message: 'Verifying the C++ compiler…', percent: 100 })
  }
  const ok = await verifyCppToolchain(found)
  if (ok) {
    return acceptVerifiedCompiler(found)
  }
  return 'retry-install'
}

export async function ensureCppToolchain(options?: {
  installIfMissing?: boolean
  mode?: EnsureCppToolchainMode
}): Promise<CompilerInfo> {
  const mode = options?.mode ?? 'full'
  const emitSearching = mode !== 'startup'
  if (ensureLock) return ensureLock
  ensureLock = (async () => {
    if (emitSearching) {
      emitToolchainProgress({ phase: 'searching', message: 'Looking for a C++ compiler…' })
    }
    let found = await detectCppCompiler()

    if (found.available && isStaleManagedCompiler(found)) {
      found = {
        ...found,
        available: false,
        compiler: null,
        path: null,
        version: null,
        setupGuidance: found.setupGuidance || setupGuidanceFallback(),
      }
    }

    if (found.available) {
      const verified = await verifyOrUseCache(found, emitSearching)
      if (verified !== 'retry-install') {
        return verified
      }
      if (found.source !== 'app-managed') {
        return withInstallFlag({
          ...found,
          available: false,
          setupGuidance: 'A C++ compiler was found but could not compile a test program.',
        })
      }
    }

    if (options?.installIfMissing === false || process.env.CODEBENCH_SKIP_TOOLCHAIN_INSTALL === '1') {
      return withInstallFlag(found.available ? found : await detectCppCompiler())
    }

    const artifact = portableToolchainForHost()
    if (!artifact) {
      emitToolchainProgress({
        phase: 'failed',
        message: found.setupGuidance || 'No C++ compiler installer is available for this computer.',
      })
      return withInstallFlag(found, { canInstall: false })
    }

    offerMacCommandLineTools()
    try {
      await installPortableToolchainOnce()
      emitToolchainProgress({ phase: 'verifying', message: 'Checking the C++ compiler…', percent: 100 })
      const installed = await detectCppCompiler()
      if (!installed.available) {
        throw new Error('The C++ compiler was downloaded but could not be verified.')
      }
      const afterInstall = await verifyOrUseCache(installed, true)
      if (afterInstall === 'retry-install') {
        throw new Error('The C++ compiler was installed but failed a test compile.')
      }
      return afterInstall
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not install a C++ compiler.'
      emitToolchainProgress({ phase: 'failed', message })
      const latest = await detectCppCompiler()
      return withInstallFlag({
        ...latest,
        available: false,
        setupGuidance: `${message} ${latest.setupGuidance}`.trim(),
      })
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
