import { app } from 'electron'
import { runCodebenchSelftest } from './codebench/selftest'

app.whenReady().then(async () => {
  const ok = await runCodebenchSelftest()
  app.exit(ok ? 0 : 1)
})
