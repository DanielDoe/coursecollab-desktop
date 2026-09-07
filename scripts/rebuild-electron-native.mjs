#!/usr/bin/env node
/** Rebuild native modules (node-pty) against the bundled Electron ABI. */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const cli = join(process.cwd(), 'node_modules', '.bin', 'electron-rebuild')
if (!existsSync(cli)) {
  console.error('electron-rebuild is not installed. Run npm install.')
  process.exit(1)
}

const result = spawnSync(cli, ['-w', 'node-pty'], {
  stdio: 'inherit',
  env: process.env,
})

process.exit(result.status ?? 1)
