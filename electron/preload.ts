import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopNotificationActionPayload, DesktopNotificationPayload } from './notifications'
import type { DesktopNotificationPreferences } from './preferences'
import type { NotificationSyncContext } from './background-sync'
import type {
  CodeBenchEvent,
  CodeBenchResizeRequest,
  CodeBenchRunRequest,
  CodeBenchStopRequest,
  CodeBenchWriteInputRequest,
  CompilerInfo,
} from './codebench/types'
import type { ToolchainProgress } from './codebench/toolchain-progress'
import type { DesktopUpdateStatus } from './updater'

const notificationNavigateListeners = new Set<(link: string) => void>()
const notificationActionListeners = new Set<(payload: DesktopNotificationActionPayload) => void>()

ipcRenderer.on('notification:navigate', (_event, link: string) => {
  for (const listener of notificationNavigateListeners) {
    listener(link)
  }
})

ipcRenderer.on('notification:action', (_event, payload: DesktopNotificationActionPayload) => {
  for (const listener of notificationActionListeners) {
    listener(payload)
  }
})

contextBridge.exposeInMainWorld('courseCollabDesktop', {
  getAppVersion: () => ipcRenderer.invoke('app:get-version') as Promise<string>,
  getCourseCollabUrl: () => ipcRenderer.invoke('app:get-course-collab-url') as Promise<string>,
  getDeviceId: () => ipcRenderer.invoke('app:get-device-id') as Promise<string>,
  setLastRoute: (path: string) =>
    ipcRenderer.invoke('app:set-last-route', path) as Promise<{ ok: boolean; path: string | null }>,
  getLastRoute: () => ipcRenderer.invoke('app:get-last-route') as Promise<string | null>,
  openExternal: (url: string) =>
    ipcRenderer.invoke('app:open-external', url) as Promise<{ ok: boolean }>,
  enterAssessmentLockdown: () =>
    ipcRenderer.invoke('assessment:enter-lockdown') as Promise<{ ok: boolean; active?: boolean }>,
  exitAssessmentLockdown: () =>
    ipcRenderer.invoke('assessment:exit-lockdown') as Promise<{ ok: boolean; active?: boolean }>,
  reassertAssessmentLockdown: () =>
    ipcRenderer.invoke('assessment:reassert-lockdown') as Promise<{ ok: boolean }>,
  isAssessmentLockdownActive: () =>
    ipcRenderer.invoke('assessment:is-lockdown-active') as Promise<{ active: boolean }>,
  getUpdateStatus: () => ipcRenderer.invoke('update:get-status') as Promise<DesktopUpdateStatus>,
  checkForUpdates: () => ipcRenderer.invoke('update:check') as Promise<DesktopUpdateStatus>,
  downloadUpdate: () => ipcRenderer.invoke('update:download') as Promise<DesktopUpdateStatus>,
  installUpdate: () => ipcRenderer.invoke('update:install') as Promise<DesktopUpdateStatus>,
  openUpdateDownloadPage: () =>
    ipcRenderer.invoke('update:open-download-page') as Promise<{ ok: boolean }>,
  onUpdateStatus: (handler: (status: DesktopUpdateStatus) => void) => {
    const listener = (_event: unknown, payload: DesktopUpdateStatus) => {
      if (payload && typeof payload === 'object' && 'state' in payload) {
        handler(payload)
      }
    }
    ipcRenderer.on('update:status', listener)
    return () => {
      ipcRenderer.removeListener('update:status', listener)
    }
  },
  platform: process.platform,
  isDesktopShell: true as const,
  showNotification: (payload: DesktopNotificationPayload) =>
    ipcRenderer.invoke('notification:show', payload) as Promise<{ ok: boolean }>,
  setBadgeCount: (count: number) =>
    ipcRenderer.invoke('notification:set-badge', count) as Promise<{ ok: boolean; count: number }>,
  clearBadgeCount: () => ipcRenderer.invoke('notification:clear-badge') as Promise<{ ok: boolean }>,
  getNotificationSupport: () =>
    ipcRenderer.invoke('notification:get-support') as Promise<{
      supported: boolean
      platform: string
      sounds: boolean
      grouping: boolean
      tray: boolean
      actions: boolean
      quietHours: boolean
      backgroundSync: boolean
      pushWhenQuit: string
    }>,
  getNotificationPreferences: () =>
    ipcRenderer.invoke('notification:get-preferences') as Promise<DesktopNotificationPreferences>,
  setNotificationPreferences: (patch: Partial<DesktopNotificationPreferences>) =>
    ipcRenderer.invoke('notification:set-preferences', patch) as Promise<DesktopNotificationPreferences>,
  setNotificationSyncContext: (context: NotificationSyncContext | null) =>
    ipcRenderer.invoke('notification:set-sync-context', context) as Promise<{ ok: boolean }>,
  onNotificationNavigate: (handler: (link: string) => void) => {
    notificationNavigateListeners.add(handler)
    return () => {
      notificationNavigateListeners.delete(handler)
    }
  },
  setup: {
    scan: () => ipcRenderer.invoke('setup:scan'),
    install: () => ipcRenderer.invoke('setup:install'),
    finish: () => ipcRenderer.invoke('setup:finish') as Promise<{ ok: boolean }>,
  },
  onNotificationAction: (handler: (payload: DesktopNotificationActionPayload) => void) => {
    notificationActionListeners.add(handler)
    return () => {
      notificationActionListeners.delete(handler)
    }
  },
  codebench: {
    checkCompiler: () => ipcRenderer.invoke('codebench:check-compiler') as Promise<CompilerInfo>,
    warmupToolchain: () => ipcRenderer.invoke('codebench:warmup-toolchain') as Promise<CompilerInfo>,
    ensureToolchain: () => ipcRenderer.invoke('codebench:ensure-toolchain') as Promise<CompilerInfo>,
    loadWorkspace: (studentId?: string | null) =>
      ipcRenderer.invoke('codebench:load-workspace', studentId) as Promise<{
        ok: boolean
        workspace: unknown | null
      }>,
    saveWorkspace: (workspace: unknown, studentId?: string | null) =>
      ipcRenderer.invoke('codebench:save-workspace', workspace, studentId) as Promise<{
        ok: boolean
        path: string
        error?: string
      }>,
    loadProblemWorkspace: (storageKey: string) =>
      ipcRenderer.invoke('codebench:load-problem-workspace', storageKey) as Promise<{
        ok: boolean
        record: unknown | null
      }>,
    saveProblemWorkspace: (record: unknown, storageKey: string) =>
      ipcRenderer.invoke('codebench:save-problem-workspace', record, storageKey) as Promise<{
        ok: boolean
        path: string
        error?: string
      }>,
    syncProjectFiles: (workspace: unknown, studentId?: string | null) =>
      ipcRenderer.invoke('codebench:sync-project-files', workspace, studentId) as Promise<{
        ok: boolean
        root: string
        filesWritten: number
        error?: string
      }>,
    getLocalProjectsRoot: (studentId?: string | null) =>
      ipcRenderer.invoke('codebench:get-local-root', studentId) as Promise<{ ok: boolean; path: string }>,
    chooseLocalProjectsFolder: () =>
      ipcRenderer.invoke('codebench:choose-local-folder') as Promise<{
        ok: boolean
        path: string
        canceled?: boolean
      }>,
    revealLocalProjectsFolder: () =>
      ipcRenderer.invoke('codebench:reveal-local-folder') as Promise<{ ok: boolean; path: string }>,
    run: (request: CodeBenchRunRequest) =>
      ipcRenderer.invoke('codebench:run', request) as Promise<
        { ok: true; sessionId: string } | { ok: false; error: string; code: string }
      >,
    writeInput: (request: CodeBenchWriteInputRequest) =>
      ipcRenderer.invoke('codebench:write-input', request) as Promise<{ ok: boolean; error?: string }>,
    stop: (request: CodeBenchStopRequest) =>
      ipcRenderer.invoke('codebench:stop', request) as Promise<{ ok: boolean }>,
    resize: (request: CodeBenchResizeRequest) =>
      ipcRenderer.invoke('codebench:resize', request) as Promise<{ ok: boolean }>,
    subscribe: (handler: (event: CodeBenchEvent) => void) => {
      const listener = (_event: unknown, payload: CodeBenchEvent) => {
        if (payload && typeof payload === 'object' && 'sessionId' in payload) {
          handler(payload)
        }
      }
      ipcRenderer.on('codebench:event', listener)
      return () => {
        ipcRenderer.removeListener('codebench:event', listener)
      }
    },
    subscribeToolchain: (handler: (progress: ToolchainProgress) => void) => {
      const listener = (_event: unknown, payload: ToolchainProgress) => {
        if (payload && typeof payload === 'object' && 'phase' in payload) {
          handler(payload)
        }
      }
      ipcRenderer.on('codebench:toolchain', listener)
      return () => {
        ipcRenderer.removeListener('codebench:toolchain', listener)
      }
    },
  },
})
