import { describe, expect, it } from 'vitest'
import { compilerFingerprint, manifestVersionForHost } from './toolchain-verify-cache'
import type { CompilerInfo } from './types'

describe('toolchain-verify-cache', () => {
  it('builds a stable compiler fingerprint', () => {
    const info: CompilerInfo = {
      available: true,
      compiler: 'g++',
      path: '/usr/bin/g++',
      version: '14.1',
      source: 'system',
      setupGuidance: '',
    }
    expect(compilerFingerprint(info)).toBe('system|/usr/bin/g++|14.1|g++')
    expect(compilerFingerprint({ ...info, path: '/other/g++' })).not.toBe(compilerFingerprint(info))
  })

  it('exposes manifest version for host', () => {
    expect(typeof manifestVersionForHost()).toBe('string')
  })
})
