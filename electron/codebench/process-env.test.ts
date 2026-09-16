import { describe, expect, it } from 'vitest'
import { applyWindowsAppDataFallbacks } from './process-env'

describe('applyWindowsAppDataFallbacks', () => {
  it('derives LOCALAPPDATA and APPDATA from USERPROFILE when unset', () => {
    if (process.platform !== 'win32') return
    const env: NodeJS.ProcessEnv = { USERPROFILE: 'C:\\Users\\student' }
    applyWindowsAppDataFallbacks(env)
    expect(env.LOCALAPPDATA).toBe('C:\\Users\\student\\AppData\\Local')
    expect(env.APPDATA).toBe('C:\\Users\\student\\AppData\\Roaming')
  })

  it('does not overwrite existing LOCALAPPDATA', () => {
    if (process.platform !== 'win32') return
    const env: NodeJS.ProcessEnv = {
      USERPROFILE: 'C:\\Users\\student',
      LOCALAPPDATA: 'D:\\Custom\\Local',
    }
    applyWindowsAppDataFallbacks(env)
    expect(env.LOCALAPPDATA).toBe('D:\\Custom\\Local')
  })
})
