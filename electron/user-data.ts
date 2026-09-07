import { app } from 'electron'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** Keep Chromium profile under CourseCollab even if the process name is still Electron. */
export function pinDesktopUserData(): string {
  app.setName('CourseCollab')
  const dest = join(app.getPath('appData'), 'CourseCollab')
  app.setPath('userData', dest)
  return dest
}

/** Move the persisted web profile off the default Electron folder after branding. */
export function migrateLegacyElectronProfile(): void {
  const dest = app.getPath('userData')
  const legacy = join(app.getPath('appData'), 'Electron')
  const destPartition = join(dest, 'Partitions', 'coursecollab')
  const legacyPartition = join(legacy, 'Partitions', 'coursecollab')
  if (existsSync(destPartition) || !existsSync(legacyPartition)) return
  try {
    mkdirSync(join(dest, 'Partitions'), { recursive: true })
    cpSync(legacyPartition, destPartition, { recursive: true })
  } catch (error) {
    console.warn('[desktop] could not migrate Electron session profile:', error)
  }
}
