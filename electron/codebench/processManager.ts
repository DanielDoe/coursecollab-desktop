import { CODEBENCH_LIMITS } from './limits'
import { LocalExecutionSandbox } from './sandbox'
import { detectCppCompiler } from './compilerDetector'
import { ensureCppToolchain } from './toolchain-ensure'
import {
  cleanupStaleSessions,
  createSessionId,
  createSessionWorkspace,
  getExecutablePath,
  removeSessionWorkspace,
} from './workspace'
import { sanitizeStudentOutput } from './diagnostics'
import type {
  CodeBenchEvent,
  CodeBenchEventSink,
  CodeBenchProcessState,
  CodeBenchRunRequest,
  CodeBenchStopReason,
  CompilerInfo,
} from './types'

type ManagedSession = {
  id: string
  state: CodeBenchProcessState
  sink: CodeBenchEventSink
  workspaceDir: string
  startedAt: number
  outputBytes: number
  rateBytes: number
  rateWindowStart: number
  runTimer: NodeJS.Timeout | null
  exitEmitted: boolean
  stopReason: CodeBenchStopReason | null
}

export type RunAck =
  | { ok: true; sessionId: string }
  | { ok: false; error: string; code: 'busy' | 'invalid' | 'no-compiler' | 'workspace' | 'internal' }

const busyStates = new Set<CodeBenchProcessState>(['COMPILING', 'RUNNING', 'WAITING_FOR_INPUT', 'STOPPING'])

export class CodeBenchProcessManager {
  private readonly sessions = new Map<string, ManagedSession>()
  private readonly sandbox = new LocalExecutionSandbox()
  private staleTimer: NodeJS.Timeout | null = null

  startBackgroundJobs(): void {
    void this.sweepStale()
    this.staleTimer = setInterval(() => {
      void this.sweepStale()
    }, 15 * 60 * 1000)
    this.staleTimer.unref?.()
  }

  async checkCompiler(): Promise<CompilerInfo> {
    return detectCppCompiler()
  }

  async warmupToolchain(): Promise<CompilerInfo> {
    return ensureCppToolchain({ installIfMissing: true, mode: 'startup' })
  }

  async ensureToolchain(): Promise<CompilerInfo> {
    return ensureCppToolchain({ installIfMissing: true, mode: 'full' })
  }

  hasBusySession(): boolean {
    for (const session of this.sessions.values()) {
      if (busyStates.has(session.state)) return true
    }
    return false
  }

  beginRun(sink: CodeBenchEventSink, request: CodeBenchRunRequest): RunAck {
    if (this.hasBusySession()) {
      return { ok: false, error: 'A program is already running. Stop it before running again.', code: 'busy' }
    }
    if (!request || request.language !== 'cpp' || typeof request.sourceCode !== 'string') {
      return { ok: false, error: 'Only C++ source can be run in this preview.', code: 'invalid' }
    }
    if (Buffer.byteLength(request.sourceCode, 'utf8') > CODEBENCH_LIMITS.maxSourceBytes) {
      return { ok: false, error: 'Source is too large for CodeBench Desktop.', code: 'invalid' }
    }

    const sessionId = createSessionId()
    const session: ManagedSession = {
      id: sessionId,
      state: 'COMPILING',
      sink,
      workspaceDir: '',
      startedAt: Date.now(),
      outputBytes: 0,
      rateBytes: 0,
      rateWindowStart: Date.now(),
      runTimer: null,
      exitEmitted: false,
      stopReason: null,
    }
    this.sessions.set(sessionId, session)
    void this.execute(session, request.sourceCode)
    return { ok: true, sessionId }
  }

  writeInput(sessionId: string, data: string): { ok: boolean; error?: string } {
    const session = this.sessions.get(sessionId)
    if (!session) return { ok: false, error: 'No active session.' }
    if (typeof data !== 'string') return { ok: false, error: 'Invalid input.' }
    if (Buffer.byteLength(data, 'utf8') > CODEBENCH_LIMITS.maxInputWriteBytes) {
      return { ok: false, error: 'Input chunk too large.' }
    }
    if (session.state !== 'RUNNING' && session.state !== 'WAITING_FOR_INPUT') {
      return { ok: false, error: 'Program is not waiting for input.' }
    }
    const written = this.sandbox.write(sessionId, data)
    if (written) session.state = 'RUNNING'
    return written ? { ok: true } : { ok: false, error: 'Could not write to the running program.' }
  }

  resize(sessionId: string, cols: number, rows: number): { ok: boolean } {
    const session = this.sessions.get(sessionId)
    if (!session) return { ok: false }
    return { ok: this.sandbox.resize(sessionId, cols, rows) }
  }

  async stop(sessionId: string, reason: CodeBenchStopReason = 'user'): Promise<{ ok: boolean }> {
    const session = this.sessions.get(sessionId)
    if (!session) return { ok: false }
    if (session.state === 'STOPPING' || session.state === 'COMPLETED' || session.state === 'FAILED') {
      return { ok: true }
    }
    session.state = 'STOPPING'
    session.stopReason = reason
    await this.sandbox.stop(sessionId, reason)
    this.finish(session, null, reason)
    return { ok: true }
  }

  async stopAll(reason: CodeBenchStopReason = 'shutdown'): Promise<void> {
    const ids = [...this.sessions.keys()]
    await Promise.all(ids.map((id) => this.stop(id, reason)))
  }

  stopForSink(sinkId: number | undefined, reason: CodeBenchStopReason = 'navigation'): void {
    if (sinkId == null) return
    for (const session of this.sessions.values()) {
      if (session.sink.id === sinkId) {
        void this.stop(session.id, reason)
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.staleTimer) clearInterval(this.staleTimer)
    this.staleTimer = null
    await this.stopAll('shutdown')
    await this.sweepStale(true)
  }

  private emit(session: ManagedSession, event: CodeBenchEvent): void {
    if (session.sink.isDestroyed?.()) return
    session.sink.send('codebench:event', event)
  }

  private async execute(session: ManagedSession, sourceCode: string): Promise<void> {
    this.emit(session, { type: 'compile:start', sessionId: session.id })
    try {
      session.workspaceDir = await createSessionWorkspace(session.id, sourceCode)
    } catch {
      session.state = 'FAILED'
      this.emit(session, { type: 'compile:error', sessionId: session.id, message: 'Could not create a temporary workspace.' })
      this.emit(session, {
        type: 'compile:complete',
        sessionId: session.id,
        success: false,
        exitCode: null,
        durationMs: 0,
        diagnostics: [],
      })
      this.sessions.delete(session.id)
      return
    }

    const compile = await this.sandbox.compile({
      sessionId: session.id,
      sourceCode,
      workspaceDir: session.workspaceDir,
      emit: (event) => this.emit(session, event),
    })

    this.emit(session, {
      type: 'compile:complete',
      sessionId: session.id,
      success: compile.success,
      exitCode: compile.exitCode,
      durationMs: compile.durationMs,
      diagnostics: compile.diagnostics,
    })

    if (!compile.success) {
      session.state = 'FAILED'
      await removeSessionWorkspace(session.id)
      this.sessions.delete(session.id)
      return
    }

    const executablePath = getExecutablePath(session.workspaceDir)
    session.state = 'RUNNING'
    this.emit(session, { type: 'process:start', sessionId: session.id })
    session.runTimer = setTimeout(() => {
      void this.stop(session.id, 'timeout')
    }, CODEBENCH_LIMITS.runTimeoutMs)

    try {
      const exitCode = await this.sandbox.run({
        sessionId: session.id,
        executablePath,
        workspaceDir: session.workspaceDir,
        emit: (event) => this.emit(session, event),
        onOutput: (chunk) => {
          const verdict = this.acceptOutput(session, chunk)
          if (verdict === 'limit') {
            session.stopReason = 'output-limit'
            void this.stop(session.id, 'output-limit')
          }
          return verdict
        },
      })
      if (!session.exitEmitted) {
        this.finish(session, exitCode, session.stopReason ?? 'exit')
      }
    } catch {
      this.emit(session, { type: 'process:error', sessionId: session.id, message: 'PTY creation failed.' })
      this.finish(session, null, 'crash')
    }
  }

  private acceptOutput(session: ManagedSession, chunk: string): 'ok' | 'limit' {
    const data = sanitizeStudentOutput(chunk, session.workspaceDir)
    const bytes = Buffer.byteLength(data, 'utf8')
    const now = Date.now()
    if (now - session.rateWindowStart > CODEBENCH_LIMITS.outputRateWindowMs) {
      session.rateWindowStart = now
      session.rateBytes = 0
    }
    session.rateBytes += bytes
    session.outputBytes += bytes
    if (
      session.outputBytes > CODEBENCH_LIMITS.maxOutputBytes ||
      session.rateBytes > CODEBENCH_LIMITS.outputRateMaxBytes
    ) {
      return 'limit'
    }
    if (session.state === 'RUNNING') session.state = 'WAITING_FOR_INPUT'
    this.emit(session, { type: 'process:output', sessionId: session.id, data })
    return 'ok'
  }

  private finish(
    session: ManagedSession,
    exitCode: number | null,
    reason: 'exit' | CodeBenchStopReason | 'crash',
  ): void {
    if (session.exitEmitted) return
    session.exitEmitted = true
    if (session.runTimer) clearTimeout(session.runTimer)
    session.runTimer = null
    session.state = reason === 'exit' && exitCode === 0 ? 'COMPLETED' : reason === 'user' ? 'COMPLETED' : 'FAILED'

    let message: string | undefined
    if (reason === 'user') message = 'Process terminated.'
    if (reason === 'timeout') message = 'Execution stopped: time limit reached.'
    if (reason === 'output-limit') message = 'Execution stopped: excessive output.'
    if (reason === 'shutdown' || reason === 'navigation') message = 'Process terminated.'

    this.emit(session, {
      type: 'process:exit',
      sessionId: session.id,
      exitCode,
      reason,
      message,
    })

    const id = session.id
    void removeSessionWorkspace(id).finally(() => {
      this.sessions.delete(id)
    })
  }

  private async sweepStale(forceAll = false): Promise<void> {
    const active = new Set(this.sessions.keys())
    if (forceAll) {
      await cleanupStaleSessions(new Set())
      return
    }
    await cleanupStaleSessions(active)
  }
}

export const codeBenchProcessManager = new CodeBenchProcessManager()
