import { spawn } from 'node:child_process'
import { CONTROLLED_COMPILE_ARGS, CONTROLLED_MSVC_ARGS, CODEBENCH_LIMITS, SOURCE_FILE_NAME } from './limits'
import { parseCompilerDiagnostics, sanitizeStudentOutput } from './diagnostics'
import { binDirForCompiler, prependPath } from './toolchain-paths'
import { getExecutableName } from './workspace'
import type { CompileResult, CompilerInfo, ExecutionSandboxCompileInput } from './types'

function compilerEnvironment(compiler: CompilerInfo): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    Path: process.env.Path,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    TMPDIR: process.env.TMPDIR,
    TMP: process.env.TMP,
    TEMP: process.env.TEMP,
    LANG: process.env.LANG ?? 'en_US.UTF-8',
    LC_ALL: process.env.LC_ALL,
    SDKROOT: process.env.SDKROOT,
    DEVELOPER_DIR: process.env.DEVELOPER_DIR,
    INCLUDE: process.env.INCLUDE,
    LIB: process.env.LIB,
    LIBPATH: process.env.LIBPATH,
    SystemRoot: process.env.SystemRoot,
    SYSTEMROOT: process.env.SYSTEMROOT,
    WINDIR: process.env.WINDIR,
  }
  for (const [key, value] of Object.entries(env)) {
    if (value == null) delete env[key]
  }
  return prependPath(env, binDirForCompiler(compiler.path))
}

function compileArgs(compiler: CompilerInfo, outputName: string): string[] {
  if (compiler.compiler === 'cl') {
    return [...CONTROLLED_MSVC_ARGS, SOURCE_FILE_NAME, `/Fe:${outputName}`]
  }
  if (compiler.compiler === 'zig') {
    return ['c++', SOURCE_FILE_NAME, ...CONTROLLED_COMPILE_ARGS, '-o', outputName]
  }
  return [SOURCE_FILE_NAME, ...CONTROLLED_COMPILE_ARGS, '-o', outputName]
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
      env: compilerEnvironment(compiler),
      shell: false,
      windowsHide: true,
    })

    const timer = setTimeout(() => {
      child.kill()
      finish(null, 'Compilation timed out.')
    }, CODEBENCH_LIMITS.compileTimeoutMs)

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
