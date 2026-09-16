/**
 * Run: npx tsx --test electron/codebench/toolchain-manifest.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PORTABLE_TOOLCHAINS, portableToolchainKey } from './toolchain-manifest'

describe('portableToolchainKey', () => {
  it('picks the official Zig archive for each desktop platform', () => {
    assert.equal(portableToolchainKey('darwin', 'arm64'), 'aarch64-macos')
    assert.equal(portableToolchainKey('darwin', 'x64'), 'x86_64-macos')
    assert.equal(portableToolchainKey('win32', 'x64'), 'x86_64-windows')
    assert.equal(portableToolchainKey('win32', 'arm64'), 'aarch64-windows')
    assert.equal(portableToolchainKey('linux', 'x64'), 'x86_64-linux')
    assert.equal(portableToolchainKey('linux', 'arm64'), 'aarch64-linux')
  })

  it('keeps a sha256 and driver for every host', () => {
    for (const artifact of Object.values(PORTABLE_TOOLCHAINS)) {
      assert.match(artifact.sha256, /^[a-f0-9]{64}$/)
      assert.ok(artifact.driver === 'g++' || artifact.driver === 'zig')
      if (artifact.driver === 'g++') {
        assert.match(artifact.binary, /g\+\+(\.exe)?$/)
      } else {
        assert.match(artifact.binary, /zig(\.exe)?$/)
      }
      assert.ok(artifact.url.includes(artifact.version) || artifact.url.includes('winlibs'))
    }
  })

  it('uses MinGW g++ on Windows x64', () => {
    const win = PORTABLE_TOOLCHAINS['x86_64-windows']
    assert.equal(win.driver, 'g++')
    assert.equal(win.binary, 'mingw64/bin/g++.exe')
  })
})
