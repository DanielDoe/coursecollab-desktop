/**
 * Run: npx tsx --test electron/codebench/toolchain-locate.test.ts
 */
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { findExtractedBinary } from './toolchain-install'

describe('findExtractedBinary', () => {
  it('uses the expected path when the archive layout matches', () => {
    const root = mkdtempSync(join(tmpdir(), 'cc-toolchain-'))
    try {
      const expected = join(root, 'mingw64', 'bin', 'g++.exe')
      mkdirSync(join(root, 'mingw64', 'bin'), { recursive: true })
      mkdirSync(join(root, 'extra'), { recursive: true })
      writeFileSync(expected, '')
      writeFileSync(join(root, 'extra', 'g++.exe'), '')
      assert.equal(findExtractedBinary(root, 'mingw64/bin/g++.exe'), expected)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('finds the driver when the archive added a top-level folder', () => {
    const root = mkdtempSync(join(tmpdir(), 'cc-toolchain-'))
    try {
      const nested = join(root, 'winlibs', 'mingw64', 'bin', 'g++.exe')
      mkdirSync(join(root, 'winlibs', 'mingw64', 'bin'), { recursive: true })
      writeFileSync(nested, '')
      assert.equal(findExtractedBinary(root, 'mingw64/bin/g++.exe'), nested)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
