import { spawn } from 'node:child_process'
import { CONTROLLED_COMPILE_ARGS, CONTROLLED_MSVC_ARGS, CODEBENCH_LIMITS, SOURCE_FILE_NAME } from './limits'
import { parseCompilerDiagnostics, sanitizeStudentOutput } from './diagnostics'
import { buildCompilerChildEnv } from './process-env'
import { getExecutableName, writeLiveFlushHeader } from './workspace'
import type { CompileResult, CompilerInfo, ExecutionSandboxCompileInput } from './types'

function compileArgs(compiler: CompilerInfo, outputName: string): string[] {
  if (compiler.compiler === 'cl') {
    return [...CONTROLLED_MSVC_ARGS, '/FI', 'cc-live-flush.h', SOURCE_FILE_NAME, `/Fe:${outputName}`]
  }
  if (compiler.compiler === 'zig') {
    return ['c++', '-include', 'cc-live-flush.h', SOURCE_FILE_NAME, ...CONTROLLED_COMPILE_ARGS, '-o', outputName]
  }
  return ['-include', 'cc-live-flush.h', SOURCE_FILE_NAME, ...CONTROLLED_COMPILE_ARGS, '-o', outputName]
}

export async function compileCppSource(
  compiler: CompilerInfo,
  input: ExecutionSandboxCompileInput,
): Promise<CompileResult> {
  if (!compiler.available || !compiler.path) {
    const message = 'Compiler not found'
    input.emit({ type: 'compile:error', sessionId: input.sessionId, message })
    return {
      success: false,
      exitCode: null,
      durationMs: 0,
      stdout: '',
      stderr: message,
      diagnostics: [],
      outputPath: null,
    }
  }

  const compilerPath = compiler.path
  const outputName = getExecutableName()
  const args = compileArgs(compiler, outputName)
  const started = Date.now()
  const timeoutMs = input.timeoutMs ?? CODEBENCH_LIMITS.compileTimeoutMs
  await writeLiveFlushHeader(input.workspaceDir)

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false

    const finish = (exitCode: number | null, errorMessage?: string) => {
      if (settled) return
      settled = true
      const durationMs = Date.now() - started
      const combined = `${stdout}${stderr}${errorMessage ? `\n${errorMessage}` : ''}`
      const diagnostics = parseCompilerDiagnostics(combined)
      resolve({
        success: exitCode === 0,
        exitCode,
        durationMs,
        stdout,
        stderr: errorMessage ? `${stderr}\n${errorMessage}`.trim() : stderr,
        diagnostics,
        outputPath: exitCode === 0 ? outputName : null,
      })
    }

    const child = spawn(compilerPath, args, {
      cwd: input.workspaceDir,
      env: buildCompilerChildEnv(compiler.path, compiler.compiler),
      shell: false,
      windowsHide: true,
    })

    const timer = setTimeout(() => {
      child.kill()
      finish(null, 'Compilation timed out.')
    }, timeoutMs)

    const handleChunk = (stream: 'stdout' | 'stderr', chunk: Buffer) => {
      const raw = chunk.toString('utf8')
      const data = sanitizeStudentOutput(raw, input.workspaceDir)
      if (stream === 'stdout') stdout += data
      else stderr += data
      if (stdout.length + stderr.length > CODEBENCH_LIMITS.maxOutputBytes) {
        child.kill()
        finish(1, 'Compilation output exceeded the safety limit.')
        return
      }
      input.emit({ type: 'compile:output', sessionId: input.sessionId, stream, data })
    }

    child.stdout?.on('data', (chunk: Buffer) => handleChunk('stdout', chunk))
    child.stderr?.on('data', (chunk: Buffer) => handleChunk('stderr', chunk))
    child.on('error', (error) => {
      clearTimeout(timer)
      const message = 'Compiler invocation failed.'
      input.emit({ type: 'compile:error', sessionId: input.sessionId, message })
      finish(null, `${message} ${error.message}`)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      finish(code)
    })
  })
}
