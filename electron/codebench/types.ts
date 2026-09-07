export const CODEBENCH_LANGUAGE_CPP = 'cpp' as const

export type CodeBenchLanguage = typeof CODEBENCH_LANGUAGE_CPP

export type CodeBenchProcessState =
  | 'IDLE'
  | 'COMPILING'
  | 'RUNNING'
  | 'WAITING_FOR_INPUT'
  | 'STOPPING'
  | 'COMPLETED'
  | 'FAILED'

export type CodeBenchStopReason =
  | 'user'
  | 'timeout'
  | 'output-limit'
  | 'shutdown'
  | 'replaced'
  | 'navigation'

export type CompilerFamily = 'clang++' | 'g++' | 'cl' | 'zig'

export type CompilerSource = 'system' | 'app-managed' | 'bundled'

export type CompilerInfo = {
  available: boolean
  compiler: CompilerFamily | null
  path: string | null
  version: string | null
  platform: NodeJS.Platform
  architecture: string
  setupGuidance: string
  source?: CompilerSource | null
  canInstall?: boolean
  installing?: boolean
  installProgress?: number
  installMessage?: string
}

export type CompilerDiagnostic = {
  file: string
  line: number
  column: number
  severity: 'error' | 'warning' | 'note' | 'fatal'
  message: string
  raw: string
}

export type CompileResult = {
  success: boolean
  exitCode: number | null
  durationMs: number
  stdout: string
  stderr: string
  diagnostics: CompilerDiagnostic[]
  outputPath: string | null
}

export type CodeBenchRunRequest = {
  sourceCode: string
  language: CodeBenchLanguage
}

export type CodeBenchWriteInputRequest = {
  sessionId: string
  data: string
}

export type CodeBenchStopRequest = {
  sessionId: string
}

export type CodeBenchResizeRequest = {
  sessionId: string
  cols: number
  rows: number
}

export type CodeBenchEvent =
  | { type: 'compile:start'; sessionId: string }
  | { type: 'compile:output'; sessionId: string; stream: 'stdout' | 'stderr'; data: string }
  | { type: 'compile:error'; sessionId: string; message: string }
  | {
      type: 'compile:complete'
      sessionId: string
      success: boolean
      exitCode: number | null
      durationMs: number
      diagnostics: CompilerDiagnostic[]
    }
  | { type: 'process:start'; sessionId: string }
  | { type: 'process:output'; sessionId: string; data: string }
  | {
      type: 'process:exit'
      sessionId: string
      exitCode: number | null
      reason: 'exit' | CodeBenchStopReason | 'crash'
      message?: string
    }
  | { type: 'process:error'; sessionId: string; message: string }

export type CodeBenchIpcChannel =
  | 'codebench:check-compiler'
  | 'codebench:ensure-toolchain'
  | 'codebench:run'
  | 'codebench:write-input'
  | 'codebench:stop'
  | 'codebench:resize'

export const CODEBENCH_EVENT_CHANNEL = 'codebench:event' as const
export const CODEBENCH_TOOLCHAIN_CHANNEL = 'codebench:toolchain' as const

export type CodeBenchEventSink = {
  id?: number
  send: (channel: string, payload: unknown) => void
  isDestroyed?: () => boolean
}

export type ExecutionSandboxCompileInput = {
  sessionId: string
  sourceCode: string
  workspaceDir: string
  emit: (event: CodeBenchEvent) => void
}

export type ExecutionSandboxRunInput = {
  sessionId: string
  executablePath: string
  workspaceDir: string
  cols?: number
  rows?: number
  pathPrefix?: string | null
  emit: (event: CodeBenchEvent) => void
  onOutput: (chunk: string) => 'ok' | 'limit'
}

/**
 * Future isolation boundary. LocalExecutionSandbox is baseline protection only.
 * Platform sandboxes (macOS seatbelt, Windows AppContainer, Linux namespaces)
 * should implement this same contract later.
 */
export interface ExecutionSandbox {
  compile(input: ExecutionSandboxCompileInput): Promise<CompileResult>
  run(input: ExecutionSandboxRunInput): Promise<number | null>
  write(sessionId: string, data: string): boolean
  resize(sessionId: string, cols: number, rows: number): boolean
  stop(sessionId: string, reason: CodeBenchStopReason): Promise<void>
}

export interface CompilerManager {
  detect(): Promise<CompilerInfo>
  ensure(): Promise<CompilerInfo>
}

export type ExecutionProviderKind = 'desktop-local' | 'web-remote'

export interface ExecutionProvider {
  readonly kind: ExecutionProviderKind
}
