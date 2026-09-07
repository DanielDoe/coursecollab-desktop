#!/usr/bin/env node
/** Brand the local Electron.app so the macOS menu bar says CourseCollab during `electron .`. */

import { copyFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const root = process.cwd()
const electronApp = join(root, 'node_modules/electron/dist/Electron.app')
const plist = join(electronApp, 'Contents/Info.plist')
const icnsSrc = join(root, 'build/icon.icns')
const icnsDest = join(electronApp, 'Contents/Resources/electron.icns')

if (process.platform !== 'darwin' || !existsSync(plist)) {
  process.exit(0)
}

function setPlist(key, value) {
  try {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist], { stdio: 'ignore' })
  } catch {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plist], { stdio: 'ignore' })
  }
}

setPlist('CFBundleName', 'CourseCollab')
setPlist('CFBundleDisplayName', 'CourseCollab')
setPlist('LSApplicationCategoryType', 'public.app-category.education')

if (existsSync(icnsSrc)) {
  copyFileSync(icnsSrc, icnsDest)
}

try {
  execFileSync('touch', [electronApp], { stdio: 'ignore' })
} catch {
  /* ignore */
}

const lsregister =
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
if (existsSync(lsregister)) {
  try {
    execFileSync(lsregister, ['-f', electronApp], { stdio: 'ignore' })
  } catch {
    /* ignore */
  }
}
