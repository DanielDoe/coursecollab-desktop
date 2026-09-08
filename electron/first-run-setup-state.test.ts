/**
 * Run: npx tsx --test electron/first-run-setup-state.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isUsableSetupState, shouldShowFirstRunSetup, SETUP_VERSION } from './first-run-setup-state'

const current = { platform: 'win32', arch: 'x64', installId: 'install-a' }

describe('isUsableSetupState', () => {
  it('rejects a completion file shipped without this install id', () => {
    assert.equal(
      isUsableSetupState(
        {
          version: SETUP_VERSION,
          completedAt: '2026-09-01T00:00:00.000Z',
          platform: 'win32',
          arch: 'x64',
          installId: 'build-machine',
        },
        current,
      ),
      false,
    )
  })

  it('rejects older completion files that only recorded compiler detection', () => {
    assert.equal(
      isUsableSetupState(
        {
          version: 2,
          completedAt: '2026-09-01T00:00:00.000Z',
          platform: 'win32',
          arch: 'x64',
        },
        current,
      ),
      false,
    )
  })

  it('accepts a marker written after setup on this install', () => {
    assert.equal(
      isUsableSetupState(
        {
          version: SETUP_VERSION,
          completedAt: '2026-09-01T00:00:00.000Z',
          platform: 'win32',
          arch: 'x64',
          installId: 'install-a',
        },
        current,
      ),
      true,
    )
  })
})

describe('shouldShowFirstRunSetup', () => {
  it('always shows setup in a packaged app even if CC_SKIP_SETUP is set', () => {
    assert.equal(
      shouldShowFirstRunSetup({
        isPackaged: true,
        skipEnv: '1',
        setupComplete: false,
      }),
      true,
    )
  })

  it('shows setup again after a reinstall (new install id / incomplete marker)', () => {
    assert.equal(
      shouldShowFirstRunSetup({
        isPackaged: true,
        setupComplete: false,
      }),
      true,
    )
  })

  it('skips setup on later launches of the same install', () => {
    assert.equal(
      shouldShowFirstRunSetup({
        isPackaged: true,
        setupComplete: true,
      }),
      false,
    )
  })
})
