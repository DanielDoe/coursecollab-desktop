import { useCallback, useEffect, useRef, useState } from 'react'
import { parseCompilerDiagnosticsText, type StudioDiagnostic } from '@/lib/codebench-compiler-diagnostics'
import { isDesktopElectronShell } from '@/lib/desktop-notifications'
import type { CodeBenchRunState } from '../types/codebench'

export type CodeBenchRunResult = {
  outcome: 'compile-error' | 'ran' | 'failed'
  diagnostics: StudioDiagnostic[]
  stderr: string
  exitCode?: number | null
}

export type UseCodeRunnerOptions = {
  onWrite: (text: string) => void
  onRunResult?: (result: CodeBenchRunResult) => void
}

function getApi() {
  return window.courseCollabDesktop?.codebench
}

function canUseViteBridge() {
  return Boolean(import.meta.env.DEV && typeof window !== "undefined" && window.location.port === "5173")
}

export function useCodeRunner({ onWrite, onRunResult }: UseCodeRunnerOptions) {
  const [compiler, setCompiler] = useState<CodeBenchCompilerInfo | null>(null)
  const [checking, setChecking] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [installProgress, setInstallProgress] = useState<number | null>(null)
  const [installMessage, setInstallMessage] = useState<string | null>(null)
  const [runState, setRunState] = useState<CodeBenchRunState>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [lastDiagnostics, setLastDiagnostics] = useState<StudioDiagnostic[]>([])
  const [lastStderr, setLastStderr] = useState('')
  const [lastFailed, setLastFailed] = useState(false)
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null)
  const sessionRef = useRef<string | null>(null)
  const stderrRef = useRef('')
  const onWriteRef = useRef(onWrite)
  const onRunResultRef = useRef(onRunResult)
  onWriteRef.current = onWrite
  onRunResultRef.current = onRunResult

  const available = Boolean((isDesktopElectronShell() && getApi()) || canUseViteBridge())

  const applyCompiler = useCallback((info: CodeBenchCompilerInfo) => {
    setCompiler(info)
    setUnavailableReason(info.available ? null : info.setupGuidance)
    return info
  }, [])

  const checkCompiler = useCallback(async () => {
    const api = getApi()
    setChecking(true)
    try {
      if (api) {
        return applyCompiler(await api.checkCompiler())
      }
      if (canUseViteBridge()) {
        const res = await fetch("/__codebench/compiler")
        return applyCompiler((await res.json()) as CodeBenchCompilerInfo)
      }
      setCompiler(null)
      setUnavailableReason("Local C++ execution is available in the CourseCollab desktop app.")
      return null
    } catch {
      setCompiler(null)
      setUnavailableReason("Could not inspect the local C++ environment.")
      return null
    } finally {
      setChecking(false)
    }
  }, [applyCompiler])

  const ensureToolchain = useCallback(async () => {
    const api = getApi()
    setInstalling(true)
    setInstallMessage("Looking for a C++ compiler…")
    try {
      if (api) {
        return applyCompiler(await api.ensureToolchain())
      }
      if (canUseViteBridge()) {
        const res = await fetch("/__codebench/ensure", { method: "POST" })
        return applyCompiler((await res.json()) as CodeBenchCompilerInfo)
      }
      return null
    } catch {
      setUnavailableReason("Could not install a C++ compiler on this computer.")
      return null
    } finally {
      setInstalling(false)
    }
  }, [applyCompiler])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const info = await checkCompiler()
      if (cancelled || info?.available || !info?.canInstall) return
      await ensureToolchain()
    })()
    return () => {
      cancelled = true
    }
  }, [checkCompiler, ensureToolchain])

  useEffect(() => {
    const api = getApi()
    if (!api?.subscribeToolchain) return
    return api.subscribeToolchain((progress) => {
      setInstalling(progress.phase !== "ready" && progress.phase !== "failed")
      setInstallProgress(typeof progress.percent === "number" ? progress.percent : null)
      setInstallMessage(progress.message)
      if (progress.phase === "failed") {
        setUnavailableReason(progress.message)
      }
    })
  }, [])

  useEffect(() => {
    const api = getApi()
    if (!api) return
    return api.subscribe((event) => {
      if (event.sessionId !== sessionRef.current) return
      switch (event.type) {
        case 'compile:start':
          setRunState('compiling')
          stderrRef.current = ''
          break
        case 'compile:output':
          stderrRef.current += event.data
          onWriteRef.current(event.data.replace(/\n/g, '\r\n'))
          break
        case 'compile:error':
          stderrRef.current += `\n${event.message}`
          onWriteRef.current(`\r\n${event.message}\r\n`)
          break
        case 'compile:complete': {
          const diagnostics = event.diagnostics?.length
            ? event.diagnostics
            : parseCompilerDiagnosticsText(stderrRef.current)
          setLastDiagnostics(diagnostics)
          setLastStderr(stderrRef.current)
          if (event.success) {
            setLastFailed(false)
            setRunState('running')
          } else {
            setLastFailed(true)
            setRunState('idle')
            setSessionId(null)
            sessionRef.current = null
            onRunResultRef.current?.({
              outcome: 'compile-error',
              diagnostics,
              stderr: stderrRef.current,
              exitCode: event.exitCode,
            })
          }
          break
        }
        case 'process:start':
          setRunState('running')
          break
        case 'process:output':
          onWriteRef.current(event.data)
          break
        case 'process:error':
          onWriteRef.current(`\r\n${event.message}\r\n`)
          break
        case 'process:exit': {
          const message =
            event.message ??
            (event.exitCode == null
              ? 'Process ended.'
              : `Process exited with code ${event.exitCode}.`)
          onWriteRef.current(`\r\n\x1b[90m${message}\x1b[0m\r\n`)
          setRunState('idle')
          setSessionId(null)
          sessionRef.current = null
          const failed = event.exitCode != null && event.exitCode !== 0
          setLastFailed(failed)
          onRunResultRef.current?.({
            outcome: failed ? 'failed' : 'ran',
            diagnostics: [],
            stderr: stderrRef.current,
            exitCode: event.exitCode,
          })
          break
        }
        default:
          break
      }
    })
  }, [])

  useEffect(() => {
    return () => {
      const id = sessionRef.current
      if (id) void getApi()?.stop({ sessionId: id })
    }
  }, [])

  const run = useCallback(
    async (sourceCode: string) => {
      if (runState === "compiling" || runState === "running" || runState === "stopping") return
      setLastDiagnostics([])
      setLastStderr("")
      setLastFailed(false)
      stderrRef.current = ""
      const api = getApi()
      if (api) {
        const result = await api.run({ sourceCode, language: "cpp" })
        if (!result.ok) {
          onWriteRef.current(`\r\n${result.error}\r\n`)
          setLastFailed(true)
          onRunResultRef.current?.({ outcome: "failed", diagnostics: [], stderr: result.error })
          return
        }
        sessionRef.current = result.sessionId
        setSessionId(result.sessionId)
        setRunState("compiling")
        return
      }
      if (!canUseViteBridge()) return
      setRunState("compiling")
      try {
        const res = await fetch("/__codebench/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceCode }),
        })
        const data = (await res.json()) as {
          success?: boolean
          stdout?: string
          stderr?: string
          exitCode?: number | null
          error?: string
        }
        if (!res.ok) {
          onWriteRef.current(`${data.error || "Compile request failed."}\r\n`)
          setLastFailed(true)
          onRunResultRef.current?.({ outcome: "failed", diagnostics: [], stderr: data.error || "" })
          setRunState("idle")
          return
        }
        const stderr = data.stderr || ""
        const diagnostics = parseCompilerDiagnosticsText(stderr)
        setLastDiagnostics(diagnostics)
        setLastStderr(stderr)
        if (stderr) onWriteRef.current(stderr.replace(/\n/g, "\r\n"))
        if (data.success) {
          setLastFailed(false)
          setRunState("running")
          if (data.stdout) onWriteRef.current(data.stdout.replace(/\n/g, "\r\n"))
          onWriteRef.current(`\r\n\x1b[90mProcess exited with code ${data.exitCode ?? 0}.\x1b[0m\r\n`)
          onRunResultRef.current?.({
            outcome: "ran",
            diagnostics,
            stderr,
            exitCode: data.exitCode ?? 0,
          })
        } else {
          setLastFailed(true)
          onRunResultRef.current?.({
            outcome: diagnostics.length ? "compile-error" : "failed",
            diagnostics,
            stderr,
            exitCode: data.exitCode ?? null,
          })
        }
      } catch {
        onWriteRef.current("\r\nCould not reach the local C++ compiler.\r\n")
        setLastFailed(true)
        onRunResultRef.current?.({ outcome: "failed", diagnostics: [], stderr: "" })
      } finally {
        setRunState("idle")
      }
    },
    [runState],
  )

  const writeInput = useCallback(async (data: string) => {
    const api = getApi()
    const id = sessionRef.current
    if (!api || !id) return
    await api.writeInput({ sessionId: id, data })
  }, [])

  const stop = useCallback(async () => {
    const api = getApi()
    const id = sessionRef.current
    if (!api || !id) return
    setRunState('stopping')
    await api.stop({ sessionId: id })
  }, [])

  const resize = useCallback(async (cols: number, rows: number) => {
    const api = getApi()
    const id = sessionRef.current
    if (!api || !id) return
    await api.resize({ sessionId: id, cols, rows })
  }, [])

  return {
    available,
    compiler,
    checking,
    installing,
    installProgress,
    installMessage,
    runState,
    sessionId,
    lastDiagnostics,
    lastStderr,
    lastFailed,
    unavailableReason,
    checkCompiler,
    ensureToolchain,
    run,
    writeInput,
    stop,
    resize,
  }
}
