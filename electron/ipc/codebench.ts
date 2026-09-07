import { BrowserWindow, ipcMain, type WebContents } from 'electron'
import { join } from 'node:path'
import { codeBenchProcessManager } from '../codebench/processManager'
import { CODEBENCH_LIMITS } from '../codebench/limits'
import {
  chooseLocalProjectsRoot,
  getLocalProjectsRoot,
  revealLocalProjectsRoot,
  syncWorkspaceProjectFiles,
} from '../codebench/projectFiles'
import { loadWorkspaceStore, saveWorkspaceStore } from '../codebench/projectStore'
import { CODEBENCH_TOOLCHAIN_CHANNEL } from '../codebench/types'
import { onToolchainProgress } from '../codebench/toolchain-progress'
import type {
  CodeBenchEventSink,
  CodeBenchResizeRequest,
  CodeBenchRunRequest,
  CodeBenchStopRequest,
  CodeBenchWriteInputRequest,
} from '../codebench/types'

function sinkFromSender(sender: WebContents): CodeBenchEventSink {
  return {
    id: sender.id,
    send: (channel, payload) => {
      if (sender.isDestroyed()) return
      sender.send(channel, payload)
    },
    isDestroyed: () => sender.isDestroyed(),
  }
}

function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && CODEBENCH_LIMITS.sessionIdPattern.test(value)
}

export function registerCodebenchIpc(): void {
  codeBenchProcessManager.startBackgroundJobs()

  onToolchainProgress((progress) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      win.webContents.send(CODEBENCH_TOOLCHAIN_CHANNEL, progress)
    }
  })

  ipcMain.handle('codebench:check-compiler', async () => {
    return codeBenchProcessManager.checkCompiler()
  })

  ipcMain.handle('codebench:ensure-toolchain', async () => {
    return codeBenchProcessManager.ensureToolchain()
  })

  ipcMain.handle('codebench:run', async (event, request: CodeBenchRunRequest) => {
    return codeBenchProcessManager.beginRun(sinkFromSender(event.sender), request)
  })

  ipcMain.handle('codebench:write-input', async (_event, request: CodeBenchWriteInputRequest) => {
    if (!request || !isSessionId(request.sessionId) || typeof request.data !== 'string') {
      return { ok: false, error: 'Invalid input request.' }
    }
    return codeBenchProcessManager.writeInput(request.sessionId, request.data)
  })

  ipcMain.handle('codebench:stop', async (_event, request: CodeBenchStopRequest) => {
    if (!request || !isSessionId(request.sessionId)) {
      return { ok: false }
    }
    return codeBenchProcessManager.stop(request.sessionId, 'user')
  })

  ipcMain.handle('codebench:load-workspace', async (_event, studentId?: string | null) => {
    const workspace = await loadWorkspaceStore(typeof studentId === 'string' ? studentId : null)
    return { ok: true, workspace }
  })

  ipcMain.handle('codebench:save-workspace', async (_event, workspace: unknown, studentId?: string | null) => {
    return saveWorkspaceStore(workspace, typeof studentId === 'string' ? studentId : null)
  })

  ipcMain.handle('codebench:sync-project-files', async (_event, workspace: unknown, studentId?: string | null) => {
    return syncWorkspaceProjectFiles(workspace, typeof studentId === 'string' ? studentId : null)
  })

  ipcMain.handle('codebench:get-local-root', async (_event, studentId?: string | null) => {
    const key = (typeof studentId === 'string' ? studentId : '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)
    return { ok: true, path: join(getLocalProjectsRoot(), key || 'local') }
  })

  ipcMain.handle('codebench:choose-local-folder', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return chooseLocalProjectsRoot(window)
  })

  ipcMain.handle('codebench:reveal-local-folder', async () => {
    return revealLocalProjectsRoot()
  })

  ipcMain.handle('codebench:resize', async (_event, request: CodeBenchResizeRequest) => {
    if (!request || !isSessionId(request.sessionId)) return { ok: false }
    if (!Number.isFinite(request.cols) || !Number.isFinite(request.rows)) return { ok: false }
    return codeBenchProcessManager.resize(request.sessionId, request.cols, request.rows)
  })
}

export function stopCodebenchForSender(senderId: number): void {
  codeBenchProcessManager.stopForSink(senderId, 'navigation')
}

export async function shutdownCodebench(): Promise<void> {
  await codeBenchProcessManager.shutdown()
}
