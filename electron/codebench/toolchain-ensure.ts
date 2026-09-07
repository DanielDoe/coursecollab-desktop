import { spawn } from 'node:child_process'
import { detectCppCompiler } from './compilerDetector'
import { installPortableToolchainOnce } from './toolchain-install'
import { portableToolchainForHost } from './toolchain-manifest'
import { emitToolchainProgress } from './toolchain-progress'
import type { CompilerInfo } from './types'

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

let ensureLock: Promise<CompilerInfo> | null = null

export async function ensureCppToolchain(options?: { installIfMissing?: boolean }): Promise<CompilerInfo> {
  if (ensureLock) return ensureLock
  ensureLock = (async () => {
    emitToolchainProgress({ phase: 'searching', message: 'Looking for a C++ compiler…' })
    const found = await detectCppCompiler()
    if (found.available) {
      emitToolchainProgress({ phase: 'ready', message: 'C++ compiler ready.', percent: 100 })
      return withInstallFlag(found, { canInstall: false })
    }
    if (options?.installIfMissing === false || process.env.CODEBENCH_SKIP_TOOLCHAIN_INSTALL === '1') {
      return withInstallFlag(found)
    }
    if (!portableToolchainForHost()) {
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
      const verified = await detectCppCompiler()
      if (verified.available) {
        emitToolchainProgress({ phase: 'ready', message: 'C++ compiler ready.', percent: 100 })
        return withInstallFlag(verified, { canInstall: false })
      }
      throw new Error('The C++ compiler was downloaded but could not be verified.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not install a C++ compiler.'
      emitToolchainProgress({ phase: 'failed', message })
      return withInstallFlag({
        ...found,
        setupGuidance: `${message} ${found.setupGuidance}`.trim(),
      })
    }
  })().finally(() => {
    ensureLock = null
  })
  return ensureLock
}
