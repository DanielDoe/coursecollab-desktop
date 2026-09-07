#!/usr/bin/env node
/** Stop stray CourseCollab Desktop Electron processes before starting a new dev session. */

import { execSync } from 'node:child_process'

const commands =
  process.platform === 'win32'
    ? [`taskkill /F /IM electron.exe /T 2>nul`]
    : [
        `pkill -f "coursecollab-desktop/node_modules/electron" 2>/dev/null || true`,
        `pkill -f "coursecollab-desktop/node_modules/.bin/electron" 2>/dev/null || true`,
        `pkill -f "Downloads/coursecollab-desktop/node_modules/electron" 2>/dev/null || true`,
      ]

for (const command of commands) {
  try {
    execSync(command, { stdio: 'ignore', shell: true })
  } catch {
    /* already stopped */
  }
}
