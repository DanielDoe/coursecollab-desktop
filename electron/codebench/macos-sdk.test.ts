/**
 * Run: npx tsx --test electron/codebench/macos-sdk.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chooseLinkableSdk, sdkVersionRank, stripUnsupportedArch, tbdHasUnsupportedArch } from './macos-sdk'

const TBD = `targets: [ arm64-macos, arm64e-macos, arm64e.x1-macos, arm64e.x1-maccatalyst ]
`

describe('macos sdk linker compatibility', () => {
  it('recognizes the architecture current macOS SDK stubs added', () => {
    assert.equal(tbdHasUnsupportedArch(TBD), true)
    assert.equal(tbdHasUnsupportedArch('targets: [ arm64-macos, arm64e-macos ]'), false)
  })

  it('drops only the architecture the linker reports as unknown', () => {
    const stripped = stripUnsupportedArch(TBD)
    assert.equal(stripped.includes('arm64e.x1'), false)
    assert.match(stripped, /arm64-macos/)
    assert.match(stripped, /arm64e-macos/)
    assert.doesNotMatch(stripped, /,\s*\]/)
  })

  it('prefers an older SDK the linker can already read', () => {
    const chosen = chooseLinkableSdk([
      { path: '/SDKs/MacOSX27.0.sdk', version: sdkVersionRank('MacOSX27.0.sdk'), unsupported: true },
      { path: '/SDKs/MacOSX26.5.sdk', version: sdkVersionRank('MacOSX26.5.sdk'), unsupported: false },
    ])
    assert.deepEqual(chosen, { path: '/SDKs/MacOSX26.5.sdk', shim: false })
  })

  it('shims the newest SDK when every installed SDK has the new architecture', () => {
    const chosen = chooseLinkableSdk([
      { path: '/SDKs/MacOSX27.0.sdk', version: sdkVersionRank('MacOSX27.0.sdk'), unsupported: true },
    ])
    assert.deepEqual(chosen, { path: '/SDKs/MacOSX27.0.sdk', shim: true })
  })
})
