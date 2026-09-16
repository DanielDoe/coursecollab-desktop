#!/usr/bin/env node
/**
 * Re-pin desktop Magnific chrome + shell routes to the last known good desktop release (0.1.9).
 * Runs automatically before `dev:vite` and `build:desktop:mac` to protect desktop Magnific chrome.
 * Instructor CodeBench panels are NOT restored here — they evolve with product work in dev.
 */

import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DESKTOP_UI_REF = 'e7b5f16'

const PATHS = [
  'app/auth/welcome',
  'app/desktop',
  'app/instructor/dashboard-v2/layout.tsx',
  'app/student/dashboard-v2/layout.tsx',
  'app/student/dashboard-v2/codebench/page.tsx',
  'app/student/dashboard-v2/codebench/ide/page.tsx',
  'app/instructor/dashboard-v2/codebench',
  'components/instructor/dashboard-v2/InstructorTopbarV2.tsx',
  'components/student/dashboard-v2/Topbar.tsx',
  'components/student/dashboard-v2/StudentDashboardModulePage.tsx',
  'components/student/dashboard-v2/embed-module-ui.tsx',
  'components/dashboard-v2/ShellSidebarFooter.tsx',
  'components/dashboard-v2/ShellCreateButton.tsx',
  'components/dashboard-v2/DrawerNavItem.tsx',
  'components/dashboard-v2/DashboardChromeTitlePortal.tsx',
  'components/desktop/DesktopLangSmithChrome.tsx',
  'components/desktop/DesktopWorkspaceHeader.tsx',
  'components/cora/CoraThinkingIndicator.tsx',
  'components/cora/CoraBotMark.tsx',
  'lib/appearance/magnific-shell.ts',
  'lib/faculty-membership-cache.ts',
  'lib/session-restore-guard.ts',
  'lib/faculty-session-restore-retry.ts',
  'lib/desktop-refresh-token.ts',
  'lib/desktop-auth-policy.ts',
  'lib/desktop-session-resume.ts',
  'lib/faculty-portal-nav-config.ts',
  'app/globals.css',
]

function main() {
  const existing = PATHS.filter((p) => {
    try {
      execSync(`git cat-file -e ${DESKTOP_UI_REF}:${p}`, { cwd: root, stdio: 'pipe' })
      return true
    } catch {
      return false
    }
  })
  if (!existing.length) {
    console.error('[restore-desktop-ui] no paths at ref', DESKTOP_UI_REF)
    process.exit(1)
  }
  execSync(`git checkout ${DESKTOP_UI_REF} -- ${existing.map((p) => JSON.stringify(p)).join(' ')}`, {
    cwd: root,
    stdio: 'inherit',
  })
  console.log(`[restore-desktop-ui] restored ${existing.length} path(s) from ${DESKTOP_UI_REF}`)
}

main()
