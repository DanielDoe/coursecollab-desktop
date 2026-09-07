import { Menu, app, shell, type BrowserWindow } from 'electron'
import { revealLocalProjectsRoot } from './codebench/projectFiles'
import { focusDesktopWindow, navigateDesktopPath } from './desktop-window'
import {
  getUpdateStatus,
  onDesktopUpdateStatusChange,
  requestDownloadUpdate,
  requestInstallDownloadedUpdate,
  requestManualUpdateCheck,
} from './updater'

const WEB_APP_URL = 'https://course-collab.com'

function go(path: string) {
  navigateDesktopPath(path)
}

function updateMenuLabel(): string {
  const update = getUpdateStatus()
  if (update.state === 'ready') return `Restart to Install ${update.version ?? 'Update'}`
  if (update.state === 'available') return `Download Update ${update.version ?? ''}`.trim()
  if (update.state === 'downloading') {
    return update.percent != null ? `Downloading Update… ${update.percent}%` : 'Downloading Update…'
  }
  return 'Check for Updates…'
}

function runUpdateAction(): void {
  focusDesktopWindow()
  const update = getUpdateStatus()
  if (update.state === 'ready') {
    requestInstallDownloadedUpdate()
    return
  }
  if (update.state === 'available') {
    void requestDownloadUpdate()
    return
  }
  void requestManualUpdateCheck()
}

function courseCollabMenu(): Electron.MenuItemConstructorOptions {
  return {
    label: app.name,
    submenu: [
      { role: 'about' },
      {
        label: updateMenuLabel(),
        click: () => runUpdateAction(),
      },
      { type: 'separator' },
      {
        label: 'Settings…',
        accelerator: 'CommandOrControl+,',
        click: () => go('desktop:settings'),
      },
      {
        label: 'Membership',
        click: () => go('desktop:membership'),
      },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  }
}

function fileMenu(isMac: boolean): Electron.MenuItemConstructorOptions {
  return {
    label: 'File',
    submenu: [
      {
        label: 'Reveal CodeBench Projects',
        click: () => {
          void revealLocalProjectsRoot()
        },
      },
      { type: 'separator' },
      ...(isMac
        ? [{ role: 'close' as const }]
        : [
            {
              label: 'Settings…',
              accelerator: 'CommandOrControl+,',
              click: () => go('desktop:settings'),
            },
            {
              label: updateMenuLabel(),
              click: () => runUpdateAction(),
            },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ]),
    ],
  }
}

function goMenu(): Electron.MenuItemConstructorOptions {
  return {
    label: 'Go',
    submenu: [
      {
        label: 'Home',
        accelerator: 'CommandOrControl+1',
        click: () => go('desktop:home'),
      },
      {
        label: 'Cora',
        accelerator: 'CommandOrControl+2',
        click: () => go('desktop:cora'),
      },
      {
        label: 'CodeBench',
        accelerator: 'CommandOrControl+3',
        click: () => go('desktop:codebench'),
      },
      {
        label: 'Lectures',
        accelerator: 'CommandOrControl+4',
        click: () => go('desktop:lectures'),
      },
      {
        label: 'Notes',
        click: () => go('desktop:notes'),
      },
      {
        label: 'Calendar',
        click: () => go('desktop:calendar'),
      },
      {
        label: 'Quizzes',
        click: () => go('desktop:quizzes'),
      },
      {
        label: 'Messages',
        click: () => go('desktop:messages'),
      },
      { type: 'separator' },
      {
        label: 'Switch Portal',
        accelerator: 'CommandOrControl+Shift+P',
        click: () => go('desktop:welcome'),
      },
      {
        label: 'Sign In…',
        click: () => go('desktop:signin'),
      },
    ],
  }
}

function helpMenu(): Electron.MenuItemConstructorOptions {
  return {
    role: 'help',
    submenu: [
      {
        label: 'Help Center',
        click: () => go('desktop:help'),
      },
      {
        label: 'Report a Bug',
        click: () => go('desktop:bug'),
      },
      { type: 'separator' },
      {
        label: 'CourseCollab on the Web',
        click: () => {
          void shell.openExternal(WEB_APP_URL)
        },
      },
    ],
  }
}

export function buildApplicationMenu(): Electron.Menu {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [courseCollabMenu()] : []),
    fileMenu(isMac),
    { role: 'editMenu' },
    goMenu(),
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    helpMenu(),
  ]
  return Menu.buildFromTemplate(template)
}

export function refreshApplicationMenu(): void {
  Menu.setApplicationMenu(buildApplicationMenu())
}

export function installApplicationMenu(_options?: { getMainWindow?: () => BrowserWindow | null }): void {
  refreshApplicationMenu()
  onDesktopUpdateStatusChange(() => refreshApplicationMenu())

  if (process.platform === 'darwin') {
    app.setAboutPanelOptions({
      applicationName: 'CourseCollab',
      applicationVersion: app.getVersion(),
      copyright: 'Copyright © 2026 CourseCollab',
    })
  }
}
