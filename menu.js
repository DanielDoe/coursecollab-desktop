"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApplicationMenu = buildApplicationMenu;
exports.refreshApplicationMenu = refreshApplicationMenu;
exports.installApplicationMenu = installApplicationMenu;
const electron_1 = require("electron");
const projectFiles_1 = require("./codebench/projectFiles");
const desktop_window_1 = require("./desktop-window");
const updater_1 = require("./updater");
const WEB_APP_URL = 'https://course-collab.com';
function go(path) {
    (0, desktop_window_1.navigateDesktopPath)(path);
}
function updateMenuLabel() {
    const update = (0, updater_1.getUpdateStatus)();
    if (update.state === 'ready')
        return `Restart to Install ${update.version ?? 'Update'}`;
    if (update.state === 'available')
        return `Download Update ${update.version ?? ''}`.trim();
    if (update.state === 'downloading') {
        return update.percent != null ? `Downloading Update… ${update.percent}%` : 'Downloading Update…';
    }
    return 'Check for Updates…';
}
function runUpdateAction() {
    (0, desktop_window_1.focusDesktopWindow)();
    const update = (0, updater_1.getUpdateStatus)();
    if (update.state === 'ready') {
        (0, updater_1.requestInstallDownloadedUpdate)();
        return;
    }
    if (update.state === 'available') {
        void (0, updater_1.requestDownloadUpdate)();
        return;
    }
    void (0, updater_1.requestManualUpdateCheck)();
}
function courseCollabMenu() {
    return {
        label: electron_1.app.name,
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
    };
}
function fileMenu(isMac) {
    return {
        label: 'File',
        submenu: [
            {
                label: 'Reveal CodeBench Projects',
                click: () => {
                    void (0, projectFiles_1.revealLocalProjectsRoot)();
                },
            },
            { type: 'separator' },
            ...(isMac
                ? [{ role: 'close' }]
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
                    { type: 'separator' },
                    { role: 'quit' },
                ]),
        ],
    };
}
function goMenu() {
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
    };
}
function helpMenu() {
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
                    void electron_1.shell.openExternal(WEB_APP_URL);
                },
            },
        ],
    };
}
function buildApplicationMenu() {
    const isMac = process.platform === 'darwin';
    const template = [
        ...(isMac ? [courseCollabMenu()] : []),
        fileMenu(isMac),
        { role: 'editMenu' },
        goMenu(),
        { role: 'viewMenu' },
        { role: 'windowMenu' },
        helpMenu(),
    ];
    return electron_1.Menu.buildFromTemplate(template);
}
function refreshApplicationMenu() {
    electron_1.Menu.setApplicationMenu(buildApplicationMenu());
}
function installApplicationMenu(_options) {
    refreshApplicationMenu();
    (0, updater_1.onDesktopUpdateStatusChange)(() => refreshApplicationMenu());
    if (process.platform === 'darwin') {
        electron_1.app.setAboutPanelOptions({
            applicationName: 'CourseCollab',
            applicationVersion: electron_1.app.getVersion(),
            copyright: 'Copyright © 2026 CourseCollab',
        });
    }
}
