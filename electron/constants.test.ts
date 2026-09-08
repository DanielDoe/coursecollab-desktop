/**
 * Run: npx tsx --test electron/constants.test.ts
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { DESKTOP_LOGIN_PATH, resolveInitialStartPath } from './constants'

test('packaged builds always start at the portal picker', () => {
  assert.equal(
    resolveInitialStartPath(() => '/faculty/dashboard/management/projects', true),
    DESKTOP_LOGIN_PATH,
  )
})

test('dev builds may resume the last in-app route', () => {
  assert.equal(
    resolveInitialStartPath(() => '/faculty/dashboard/management/projects', false),
    '/faculty/dashboard/management/projects',
  )
  assert.equal(resolveInitialStartPath(() => null, false), DESKTOP_LOGIN_PATH)
})
