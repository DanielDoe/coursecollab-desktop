/**
 * Run: npx tsx --test electron/codebench/toolchain-install-policy.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PORTABLE_INSTALL_COOLDOWN_MS, shouldAttemptPortableInstall } from './toolchain-install-policy'

describe('shouldAttemptPortableInstall', () => {
  const now = 1_000_000

  it('allows the first install', () => {
    assert.equal(shouldAttemptPortableInstall(null, now, false), true)
  })

  it('skips a repeat download during the cooldown', () => {
    assert.equal(shouldAttemptPortableInstall(now - 60_000, now, false), false)
  })

  it('allows another download after the cooldown', () => {
    assert.equal(
      shouldAttemptPortableInstall(now - PORTABLE_INSTALL_COOLDOWN_MS, now, false),
      true,
    )
  })

  it('lets an explicit retry download immediately', () => {
    assert.equal(shouldAttemptPortableInstall(now - 1_000, now, true), true)
  })
})
