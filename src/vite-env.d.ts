/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_COURSECOLLAB_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface DesktopNotificationPayload {
  id: string
  title: string
  body: string
  link?: string | null
  silent?: boolean
  groupKey?: string
  groupLabel?: string
  notificationId?: number
  notificationIds?: number[]
  portal?: 'student' | 'faculty' | 'admin'
  type?: string | null
  supportsReply?: boolean
}

interface DesktopNotificationActionPayload {
  action: 'mark-read' | 'reply'
  notificationId: number
  notificationIds?: number[]
  portal: 'student' | 'faculty' | 'admin'
  reply?: string
}

interface DesktopNotificationPreferences {
  soundsEnabled: boolean
  groupingEnabled: boolean
  groupByCourse: boolean
  minimizeToTray: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  launchAtLogin: boolean
  backgroundSyncEnabled: boolean
}

interface NotificationSyncContext {
  portal: 'student' | 'faculty' | 'admin'
  pollUrl: string
  headers: Record<string, string>
}

interface CodeBenchCompilerInfo {
  available: boolean
  compiler: 'clang++' | 'g++' | 'cl' | 'zig' | null
  path: string | null
  version: string | null
  platform: string
  architecture: string
  setupGuidance: string
  source?: 'system' | 'app-managed' | 'bundled' | null
  canInstall?: boolean
  installing?: boolean
  installProgress?: number
  installMessage?: string
}

interface CodeBenchToolchainProgress {
  phase: 'searching' | 'prompting-system' | 'downloading' | 'extracting' | 'verifying' | 'ready' | 'failed'
  message: string
  percent?: number
}

interface CodeBenchDiagnostic {
  file: string
  line: number
  column: number
  severity: 'error' | 'warning' | 'note' | 'fatal'
  message: string
  raw: string
}

type CodeBenchEvent =
  | { type: 'compile:start'; sessionId: string }
  | { type: 'compile:output'; sessionId: string; stream: 'stdout' | 'stderr'; data: string }
  | { type: 'compile:error'; sessionId: string; message: string }
  | {
      type: 'compile:complete'
      sessionId: string
      success: boolean
      exitCode: number | null
      durationMs: number
      diagnostics: CodeBenchDiagnostic[]
    }
  | { type: 'process:start'; sessionId: string }
  | { type: 'process:output'; sessionId: string; data: string }
  | {
      type: 'process:exit'
      sessionId: string
      exitCode: number | null
      reason: string
      message?: string
    }
  | { type: 'process:error'; sessionId: string; message: string }

interface DesktopUpdateStatus {
  state:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'ready'
    | 'error'
  supported: boolean
  currentVersion: string
  version?: string
  releaseNotes?: string
  percent?: number
  message?: string
}

interface CourseCollabDesktopBridge {
  getAppVersion: () => Promise<string>
  getCourseCollabUrl: () => Promise<string>
  getDeviceId: () => Promise<string>
  setLastRoute: (path: string) => Promise<{ ok: boolean; path: string | null }>
  getLastRoute: () => Promise<string | null>
  openExternal: (url: string) => Promise<{ ok: boolean }>
  enterAssessmentLockdown: () => Promise<{ ok: boolean; active?: boolean }>
  exitAssessmentLockdown: () => Promise<{ ok: boolean; active?: boolean }>
  reassertAssessmentLockdown: () => Promise<{ ok: boolean }>
  isAssessmentLockdownActive: () => Promise<{ active: boolean }>
  getUpdateStatus: () => Promise<DesktopUpdateStatus>
  checkForUpdates: () => Promise<DesktopUpdateStatus>
  downloadUpdate: () => Promise<DesktopUpdateStatus>
  installUpdate: () => Promise<DesktopUpdateStatus>
  openUpdateDownloadPage: () => Promise<{ ok: boolean }>
  onUpdateStatus: (handler: (status: DesktopUpdateStatus) => void) => () => void
  platform: NodeJS.Platform
  isDesktopShell: true
  showNotification: (payload: DesktopNotificationPayload) => Promise<{ ok: boolean }>
  setBadgeCount: (count: number) => Promise<{ ok: boolean; count: number }>
  clearBadgeCount: () => Promise<{ ok: boolean }>
  getNotificationSupport: () => Promise<{
    supported: boolean
    platform: string
    sounds: boolean
    grouping: boolean
    tray: boolean
    actions: boolean
    quietHours: boolean
    backgroundSync: boolean
    pushWhenQuit: string
  }>
  getNotificationPreferences: () => Promise<DesktopNotificationPreferences>
  setNotificationPreferences: (
    patch: Partial<DesktopNotificationPreferences>,
  ) => Promise<DesktopNotificationPreferences>
  setNotificationSyncContext: (context: NotificationSyncContext | null) => Promise<{ ok: boolean }>
  onNotificationNavigate: (handler: (link: string) => void) => () => void
  onNotificationAction: (handler: (payload: DesktopNotificationActionPayload) => void) => () => void
  setup: {
    scan: () => Promise<{
      platform: string
      architecture: string
      languages: Array<{
        id: 'cpp' | 'c' | 'python'
        label: string
        ready: boolean
        detail: string
        canInstall: boolean
      }>
    }>
    install: () => Promise<{
      platform: string
      architecture: string
      languages: Array<{
        id: 'cpp' | 'c' | 'python'
        label: string
        ready: boolean
        detail: string
        canInstall: boolean
      }>
    }>
    finish: () => Promise<{ ok: boolean }>
  }
  codebench: {
    checkCompiler: () => Promise<CodeBenchCompilerInfo>
    warmupToolchain: () => Promise<CodeBenchCompilerInfo>
    ensureToolchain: () => Promise<CodeBenchCompilerInfo>
    loadWorkspace: (studentId?: string | null) => Promise<{ ok: boolean; workspace: unknown | null }>
    saveWorkspace: (
      workspace: unknown,
      studentId?: string | null,
    ) => Promise<{ ok: boolean; path: string; error?: string }>
    loadProblemWorkspace: (storageKey: string) => Promise<{ ok: boolean; record: unknown | null }>
    saveProblemWorkspace: (
      record: unknown,
      storageKey: string,
    ) => Promise<{ ok: boolean; path: string; error?: string }>
    syncProjectFiles: (
      workspace: unknown,
      studentId?: string | null,
    ) => Promise<{ ok: boolean; root: string; filesWritten: number; error?: string }>
    getLocalProjectsRoot: (studentId?: string | null) => Promise<{ ok: boolean; path: string }>
    chooseLocalProjectsFolder: () => Promise<{ ok: boolean; path: string; canceled?: boolean }>
    revealLocalProjectsFolder: () => Promise<{ ok: boolean; path: string }>
    run: (request: { sourceCode: string; language: 'cpp' }) => Promise<
      { ok: true; sessionId: string } | { ok: false; error: string; code: string }
    >
    writeInput: (request: { sessionId: string; data: string }) => Promise<{ ok: boolean; error?: string }>
    stop: (request: { sessionId: string }) => Promise<{ ok: boolean }>
    resize: (request: { sessionId: string; cols: number; rows: number }) => Promise<{ ok: boolean }>
    subscribe: (handler: (event: CodeBenchEvent) => void) => () => void
    subscribeToolchain: (handler: (progress: CodeBenchToolchainProgress) => void) => () => void
  }
}

interface Window {
  courseCollabDesktop?: CourseCollabDesktopBridge
  __COURSE_COLLAB_DESKTOP__?: boolean
  __COURSE_COLLAB_NATIVE__?: boolean
}
