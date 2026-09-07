import { compileCppSource } from './compiler'
import { detectCppCompiler } from './compilerDetector'
import { canLoadNodePty, PtySession } from './processRunner'
import { ensureCppToolchain } from './toolchain-ensure'
import { binDirForCompiler } from './toolchain-paths'
import type {
  CodeBenchStopReason,
  CompileResult,
  ExecutionSandbox,
  ExecutionSandboxCompileInput,
  ExecutionSandboxRunInput,
} from './types'

/**
 * Baseline local execution. This is NOT a security sandbox for arbitrary native
 * code. Electron isolation does not contain the compiled student binary.
 * A later platform-specific ExecutionSandbox should wrap compile/run/stop.
 */
export class LocalExecutionSandbox implements ExecutionSandbox {
  private readonly sessions = new Map<string, PtySession>()
  private compilerBinDir: string | null = null

  async compile(input: ExecutionSandboxCompileInput): Promise<CompileResult> {
    let compiler = await detectCppCompiler()
    if (!compiler.available && process.env.CODEBENCH_SKIP_TOOLCHAIN_INSTALL !== '1') {
      compiler = await ensureCppToolchain({ installIfMissing: true })
    }
    this.compilerBinDir = binDirForCompiler(compiler.path)
    return compileCppSource(compiler, input)
  }

  async run(input: ExecutionSandboxRunInput): Promise<number | null> {
    const ptyStatus = canLoadNodePty()
    if (!ptyStatus.ok) {
      throw new Error('PTY creation failed.')
    }

    const existing = this.sessions.get(input.sessionId)
    if (existing) await existing.stop('replaced')

    const session = new PtySession()
    this.sessions.set(input.sessionId, session)

    return new Promise<number | null>((resolve, reject) => {
      try {
        session.start({
          executablePath: input.executablePath,
          cwd: input.workspaceDir,
          cols: input.cols,
          rows: input.rows,
          pathPrefix: input.pathPrefix ?? this.compilerBinDir,
          onData: (data) => {
            const verdict = input.onOutput(data)
            if (verdict === 'limit') {
              void this.stop(input.sessionId, 'output-limit')
            }
          },
          onExit: (exitCode) => {
            this.sessions.delete(input.sessionId)
            resolve(exitCode)
          },
        })
      } catch (error) {
        this.sessions.delete(input.sessionId)
        reject(error)
      }
    })
  }

  write(sessionId: string, data: string): boolean {
    return this.sessions.get(sessionId)?.write(data) ?? false
  }

  resize(sessionId: string, cols: number, rows: number): boolean {
    return this.sessions.get(sessionId)?.resize(cols, rows) ?? false
  }

  async stop(sessionId: string, reason: CodeBenchStopReason): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return
    await session.stop(reason)
    this.sessions.delete(sessionId)
  }
}
