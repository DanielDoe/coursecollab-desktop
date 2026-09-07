import { detectCppCompiler } from './compilerDetector'
import { detectPythonRuntime } from './pythonDetector'
import { ensureCppToolchain } from './toolchain-ensure'

export type LanguageSetupRow = {
  id: 'cpp' | 'c' | 'python'
  label: string
  ready: boolean
  detail: string
  canInstall: boolean
}

export type LanguageSetupReport = {
  platform: NodeJS.Platform
  architecture: string
  languages: LanguageSetupRow[]
}

export async function scanLanguageEnvironments(): Promise<LanguageSetupReport> {
  const compiler = await detectCppCompiler()
  const python = await detectPythonRuntime()
  const compilerLabel = compiler.available
    ? compiler.compiler === 'zig'
      ? 'C++ compiler ready'
      : `${compiler.compiler} ready`
    : 'No C++ compiler found'
  const compilerDetail = compiler.available
    ? compiler.version || compilerLabel
    : compiler.setupGuidance

  return {
    platform: process.platform,
    architecture: process.arch,
    languages: [
      {
        id: 'cpp',
        label: 'C++',
        ready: compiler.available,
        detail: compilerDetail,
        canInstall: !compiler.available && Boolean(compiler.canInstall),
      },
      {
        id: 'c',
        label: 'C',
        ready: compiler.available,
        detail: compiler.available
          ? 'Uses the same compiler as C++.'
          : 'C is installed with the C++ compiler.',
        canInstall: false,
      },
      {
        id: 'python',
        label: 'Python',
        ready: python.available,
        detail: python.available
          ? python.version || 'Python ready'
          : 'Python was not found. You can still write Python in CodeBench; local Run for Python is next.',
        canInstall: false,
      },
    ],
  }
}

export async function installLanguageEnvironments(): Promise<LanguageSetupReport> {
  await ensureCppToolchain({ installIfMissing: true })
  return scanLanguageEnvironments()
}
