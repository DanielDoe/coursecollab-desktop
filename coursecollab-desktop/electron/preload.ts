import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('courseCollabDesktop', {
  getAppVersion: () => ipcRenderer.invoke('app:get-version') as Promise<string>,
})
