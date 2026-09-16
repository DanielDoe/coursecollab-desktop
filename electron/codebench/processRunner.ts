import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { CODEBENCH_LIMITS } from './limits'
import { buildCodebenchChildEnv } from './process-env'
import type { CodeBenchStopReason } from './types'

type PtyHandle = {
  pid: number
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(signal?: string): void
  onData(listener: (data: string) => void): { dispose: () => void }
  onExit(listener: (event: { exitCode: number; signal?: number }) => void): { dispose: () => void }
}

type PtyModule = {
  spawn(file: string, args: string[] | string, options: Record<string, unknown>): PtyHandle
}

let cachedPty: PtyModule | null | undefined

function resolveNodePty(): PtyModule {
  if (cachedPty) return cachedPty
  const require = createRequire(__filename)
  try {
    cachedPty = require('node-pty') as PtyModule
    return cachedPty
  } catch (firstError) {
    const resourcesPath = process.resourcesPath
    if (resourcesPath) {
      const unpacked = join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'node-pty')
      cachedPty = require(unpacked) as PtyModule
      return cachedPty
    }
    throw firstError
  }
}

function spawnNoShell(command: string, args: string[]): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, stdio: 'ignore' })
    child.on('error', () => resolve())
    child.on('close', () => resolve())
  })
}

export async function terminateProcessTree(pid: number | undefined): Promise<void> {
  if (!pid || pid <= 0) return
  if (process.platform === 'win32') {
    await spawnNoShell('taskkill', ['/PID', String(pid), '/T', '/F'])
    return
  }
  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    /* process group may not exist */
  }
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    /* already gone */
  }
  await new Promise((resolve) => setTimeout(resolve, 250))
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    /* ignore */
  }
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    /* ignore */
  }
}

export class PtySession {
  private handle: PtyHandle | null = null
  private disposed = false

  get pid(): number | undefined {
    return this.handle?.pid
  }

  get alive(): boolean {
    return this.handle != null && !this.disposed
  }

  start(options: {
    executablePath: string
    cwd: string
    cols?: number
    rows?: number
    pathPrefix?: string | null
    onData: (data: string) => void
    onExit: (exitCode: number | null) => void
  }): void {
    const pty = resolveNodePty()
    const handle = pty.spawn(options.executablePath, [], {
      name: 'xterm-256color',
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      cwd: options.cwd,
      env: {
        ...buildCodebenchChildEnv({ pathPrefix: options.pathPrefix }),
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    })
    this.handle = handle
    handle.onData((data) => {
      if (!this.disposed) options.onData(data)
    })
    handle.onExit(({ exitCode }) => {
      this.disposed = true
      this.handle = null
      options.onExit(typeof exitCode === 'number' ? exitCode : null)
    })
  }

  write(data: string): boolean {
    if (!this.handle || this.disposed) return false
    if (Buffer.byteLength(data, 'utf8') > CODEBENCH_LIMITS.maxInputWriteBytes) return false
    this.handle.write(data)
    return true
  }

  resize(cols: number, rows: number): boolean {
    if (!this.handle || this.disposed) return false
    if (!Number.isFinite(cols) || !Number.isFinite(rows)) return false
    this.handle.resize(Math.max(20, Math.min(300, Math.floor(cols))), Math.max(5, Math.min(120, Math.floor(rows))))
    return true
  }

  async stop(_reason: CodeBenchStopReason): Promise<void> {
    const pid = this.handle?.pid
    try {
      this.handle?.kill(process.platform === 'win32' ? undefined : 'SIGKILL')
    } catch {
      /* ignore */
    }
    await terminateProcessTree(pid)
    this.disposed = true
    this.handle = null
  }
}

export function canLoadNodePty(): { ok: true } | { ok: false; message: string } {
  try {
    resolveNodePty()
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PTY module failed to load'
    return { ok: false, message }
  }
}
