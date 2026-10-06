import { useCallback, useEffect, useRef, useState } from 'react'
import { parseCompilerDiagnosticsText, type StudioDiagnostic } from '@/lib/codebench-compiler-diagnostics'
import { silentCompilerExitMessage } from '@/electron/codebench/compiler-exit'
import { isDesktopElectronShell } from '@/lib/desktop-notifications'
import type { CodeBenchRunState } from '../types/codebench'
import type { ToolchainSetupOutcome, ToolchainSetupPhase } from '../types/toolchain-setup'

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

function explainCompilerFailure(text: string, exitCode?: number | null): string | null {
  if (/unknown architecture/i.test(text)) {
    return 'This Mac’s system libraries name a CPU type the compiler cannot read (unknown architecture, usually inside libSystem.tbd). CourseCollab points the compiler at a compatible macOS SDK. Run again after Retry setup.'
  }
  if (!text.trim()) return silentCompilerExitMessage(exitCode ?? null)
  return null
}

function getApi() {
  return window.courseCollabDesktop?.codebench
}

function canUseViteBridge() {
  return Boolean(import.meta.env.DEV && typeof window !== "undefined" && window.location.port === "5173")
}

const TOOLCHAIN_STATUS_KEY = 'cc.codebench.toolchainStatus'
const VISIBLE_TOOLCHAIN_PHASES = new Set(['downloading', 'extracting', 'prompting-system'])

function toolchainStatusKey(info: CodeBenchCompilerInfo): string {
  if (!info.available) return `missing|${info.setupGuidance ?? ''}`
  return ['ready', info.source ?? '', info.compiler ?? '', info.path ?? '', info.version ?? ''].join('|')
}

function readToolchainStatus(): string | null {
  try {
    return window.localStorage.getItem(TOOLCHAIN_STATUS_KEY)
  } catch {
    return null
  }
}

function writeToolchainStatus(value: string): void {
  try {
    window.localStorage.setItem(TOOLCHAIN_STATUS_KEY, value)
  } catch {
    /* ignore private-mode storage failures */
  }
}

export function useCodeRunner({ onWrite, onRunResult }: UseCodeRunnerOptions) {
  const [compiler, setCompiler] = useState<CodeBenchCompilerInfo | null>(null)
  const [checking, setChecking] = useState(true)
  const [installing, setInstalling] = useState(false)
  const [installProgress, setInstallProgress] = useState<number | null>(null)
  const [installMessage, setInstallMessage] = useState<string | null>(null)
  const [toolchainPhase, setToolchainPhase] = useState<ToolchainSetupPhase | null>(null)
  const [setupOutcome, setSetupOutcome] = useState<ToolchainSetupOutcome>('hidden')
  const [runState, setRunState] = useState<CodeBenchRunState>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [lastDiagnostics, setLastDiagnostics] = useState<StudioDiagnostic[]>([])
  const [lastStderr, setLastStderr] = useState('')
  const [lastFailed, setLastFailed] = useState(false)
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null)
  const setupStartedRef = useRef(false)
  const userRequestedRef = useRef(false)
  const sawVisibleWorkRef = useRef(false)
  const sessionRef = useRef<string | null>(null)
  const runTokenRef = useRef(0)
  const eventQueueRef = useRef<CodeBenchEvent[]>([])
  const dispatchEventRef = useRef<(event: CodeBenchEvent) => void>(() => {})
  const sawOutputRef = useRef(false)
  const waitHintRef = useRef<number | null>(null)
  const stderrRef = useRef('')
  const onWriteRef = useRef(onWrite)
  const onRunResultRef = useRef(onRunResult)
  onWriteRef.current = onWrite
  onRunResultRef.current = onRunResult

  const available = Boolean((isDesktopElectronShell() && getApi()) || canUseViteBridge())

  const beginToolchainSetup = useCallback(() => {
    setupStartedRef.current = true
    setSetupOutcome('active')
    setToolchainPhase('searching')
    setInstallMessage('Looking for a C++ compiler…')
  }, [])

  const compilerRef = useRef<CodeBenchCompilerInfo | null>(null)
  const checkingRef = useRef(true)
  const installingRef = useRef(false)
  compilerRef.current = compiler
  checkingRef.current = checking
  installingRef.current = installing

  const applyCompiler = useCallback((info: CodeBenchCompilerInfo) => {
    // A detect-only probe must not overwrite a compiler that warmup/install already found.
    if (compilerRef.current?.available && !info.available && !userRequestedRef.current) {
      return compilerRef.current
    }
    compilerRef.current = info
    setCompiler(info)
    setUnavailableReason(info.available ? null : info.setupGuidance)
    const key = toolchainStatusKey(info)
    const changed = readToolchainStatus() !== key
    const showResult = userRequestedRef.current || sawVisibleWorkRef.current
    if (info.available) {
      if (showResult && (changed || sawVisibleWorkRef.current)) {
        setToolchainPhase('ready')
        setSetupOutcome('success')
        setupStartedRef.current = true
      }
      writeToolchainStatus(key)
    } else if (showResult || changed) {
      setToolchainPhase('failed')
      setSetupOutcome('error')
      setupStartedRef.current = true
      writeToolchainStatus(key)
    }
    return info
  }, [])

  const dismissToolchainSetup = useCallback(() => {
    setSetupOutcome('hidden')
    setupStartedRef.current = false
  }, [])

  useEffect(() => {
    if (setupOutcome !== 'success') return
    const timer = window.setTimeout(() => {
      setSetupOutcome('hidden')
      setupStartedRef.current = false
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [setupOutcome])

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

  const waitForToolchain = useCallback(async () => {
    for (let i = 0; i < 120; i++) {
      if (!checkingRef.current && !installingRef.current) return compilerRef.current
      await new Promise((resolve) => window.setTimeout(resolve, 250))
    }
    return compilerRef.current
  }, [])

  const ensureToolchain = useCallback(async (options?: { force?: boolean; quiet?: boolean }) => {
    const api = getApi()
    if (!options?.quiet) userRequestedRef.current = true
    setInstalling(true)
    try {
      if (api) {
        return applyCompiler(await api.ensureToolchain(options?.force ? { force: true } : undefined))
      }
      if (canUseViteBridge()) {
        const res = await fetch('/__codebench/ensure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: options?.force === true }),
        })
        return applyCompiler((await res.json()) as CodeBenchCompilerInfo)
      }
      setSetupOutcome('error')
      setToolchainPhase('failed')
      return null
    } catch {
      setUnavailableReason('Could not install a C++ compiler on this computer.')
      setSetupOutcome('error')
      setToolchainPhase('failed')
      return null
    } finally {
      setInstalling(false)
      userRequestedRef.current = false
      sawVisibleWorkRef.current = false
    }
  }, [applyCompiler])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const api = getApi()
      if (!api && !canUseViteBridge()) {
        setChecking(false)
        setUnavailableReason('Local C++ execution is available in the CourseCollab desktop app.')
        return
      }
      setChecking(true)
      try {
        if (api?.warmupToolchain) {
          if (!cancelled) applyCompiler(await api.warmupToolchain())
          return
        }
        if (api) {
          if (!cancelled) applyCompiler(await api.checkCompiler())
          return
        }
        const res = await fetch('/__codebench/warmup', { method: 'POST' })
        if (!cancelled) applyCompiler((await res.json()) as CodeBenchCompilerInfo)
      } catch {
        if (!cancelled) {
          setCompiler(null)
          setUnavailableReason('Could not set up the local C++ environment.')
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyCompiler])

  useEffect(() => {
    const api = getApi()
    if (!api?.subscribeToolchain) return
    return api.subscribeToolchain((progress) => {
      const visible = VISIBLE_TOOLCHAIN_PHASES.has(progress.phase)
      if (visible) {
        sawVisibleWorkRef.current = true
        beginToolchainSetup()
      }
      const modalOpen = setupStartedRef.current
      if (visible || modalOpen) {
        setToolchainPhase(progress.phase)
        setInstalling(progress.phase !== 'ready' && progress.phase !== 'failed')
        setInstallProgress(typeof progress.percent === 'number' ? progress.percent : null)
        setInstallMessage(progress.message)
      }
      if (progress.phase === 'failed') {
        const previous = readToolchainStatus()
        const alreadyKnown = previous != null && !previous.startsWith('ready|')
        if (!alreadyKnown || userRequestedRef.current || sawVisibleWorkRef.current) {
          setUnavailableReason(progress.message)
          beginToolchainSetup()
          setSetupOutcome('error')
          if (!alreadyKnown) writeToolchainStatus(`failed|${progress.message}`)
        }
      }
      if (progress.phase === 'ready' && (userRequestedRef.current || sawVisibleWorkRef.current)) {
        setSetupOutcome('success')
        setupStartedRef.current = true
      }
    })
  }, [beginToolchainSetup])

  const clearWaitHint = useCallback(() => {
    if (waitHintRef.current == null) return
    window.clearTimeout(waitHintRef.current)
    waitHintRef.current = null
  }, [])

  useEffect(() => {
    const api = getApi()
    if (!api) return
    const dispatch = (event: CodeBenchEvent) => {
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
            const hint = explainCompilerFailure(stderrRef.current, event.exitCode)
            if (hint) onWriteRef.current(`\r\n${hint}\r\n`)
            onRunResultRef.current?.({
              outcome: 'compile-error',
              diagnostics,
              stderr: hint ? `${stderrRef.current}\n${hint}` : stderrRef.current,
              exitCode: event.exitCode,
            })
          }
          break
        }
        case 'process:start':
          setRunState('running')
          sawOutputRef.current = false
          clearWaitHint()
          waitHintRef.current = window.setTimeout(() => {
            if (sawOutputRef.current || sessionRef.current == null) return
            onWriteRef.current(
              '\r\n\x1b[90mRunning. This program is waiting for input. Type in the terminal and press Enter.\x1b[0m\r\n',
            )
          }, 1200)
          break
        case 'process:output':
          sawOutputRef.current = true
          clearWaitHint()
          onWriteRef.current(event.data)
          break
        case 'process:error':
          onWriteRef.current(`\r\n${event.message}\r\n`)
          break
        case 'process:exit': {
          clearWaitHint()
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
          const stderr = [stderrRef.current, event.message].filter(Boolean).join('\n')
          onRunResultRef.current?.({
            outcome: failed ? 'failed' : 'ran',
            diagnostics: [],
            stderr,
            exitCode: event.exitCode,
          })
          break
        }
        default:
          break
      }
    }
    dispatchEventRef.current = dispatch
    return api.subscribe((event) => {
      if (!sessionRef.current) {
        eventQueueRef.current.push(event)
        if (eventQueueRef.current.length > 200) eventQueueRef.current.shift()
        return
      }
      dispatch(event)
    })
  }, [clearWaitHint])

  const releaseSession = useCallback(async () => {
    const api = getApi()
    const id = sessionRef.current
    if (!id) return
    clearWaitHint()
    try {
      if (api) await api.stop({ sessionId: id })
    } catch {
      /* the process is already gone */
    }
    // The exit event normally clears the session and writes "Process terminated."
    // If that event never arrives, finish the same way so Run cannot stay stuck.
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    if (sessionRef.current !== id) return
    sessionRef.current = null
    setSessionId(null)
    setRunState("idle")
    onWriteRef.current("\r\n\x1b[90mProcess terminated.\x1b[0m\r\n")
    onRunResultRef.current?.({
      outcome: "ran",
      diagnostics: [],
      stderr: stderrRef.current,
      exitCode: null,
    })
  }, [clearWaitHint])

  useEffect(() => {
    return () => {
      runTokenRef.current += 1
      const id = sessionRef.current
      sessionRef.current = null
      if (id) void getApi()?.stop({ sessionId: id })
    }
  }, [])

  const run = useCallback(
    async (sourceCode: string) => {
      const token = ++runTokenRef.current
      await releaseSession()
      if (token !== runTokenRef.current) return
      setLastDiagnostics([])
      setLastStderr("")
      setLastFailed(false)
      stderrRef.current = ""
      const stale = () => token !== runTokenRef.current

      const api = getApi()
      if (api) {
        const result = await api.run({ sourceCode, language: "cpp" })
        if (token !== runTokenRef.current) {
          if (result.ok) void api.stop({ sessionId: result.sessionId })
          return
        }
        if (!result.ok) {
          if (stale()) return
          onWriteRef.current(`\r\n${result.error}\r\n`)
          setLastFailed(true)
          onRunResultRef.current?.({ outcome: "failed", diagnostics: [], stderr: result.error })
          return
        }
        sessionRef.current = result.sessionId
        setSessionId(result.sessionId)
        setRunState("compiling")
        const queued = eventQueueRef.current.filter((event) => event.sessionId === result.sessionId)
        eventQueueRef.current = []
        for (const event of queued) dispatchEventRef.current(event)
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
        if (stale()) return
        const data = (await res.json()) as {
          success?: boolean
          stdout?: string
          stderr?: string
          exitCode?: number | null
          error?: string
        }
        if (stale()) return
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
        if (!stale()) setRunState("idle")
      }
    },
    [releaseSession],
  )

  const writeInput = useCallback(async (data: string) => {
    const api = getApi()
    const id = sessionRef.current
    if (!api || !id) return
    await api.writeInput({ sessionId: id, data })
  }, [])

  const stop = useCallback(async () => {
    runTokenRef.current += 1
    if (!sessionRef.current) {
      clearWaitHint()
      setRunState("idle")
      return
    }
    setRunState("stopping")
    await releaseSession()
  }, [clearWaitHint, releaseSession])

  const resize = useCallback(async (cols: number, rows: number) => {
    const api = getApi()
    const id = sessionRef.current
    if (!api || !id) return
    await api.resize({ sessionId: id, cols, rows })
  }, [])

  const toolchainSetupOpen =
    available && setupOutcome !== 'hidden' && (setupOutcome === 'active' || setupOutcome === 'success' || setupOutcome === 'error')

  return {
    available,
    compiler,
    checking,
    installing,
    installProgress,
    installMessage,
    toolchainPhase,
    setupOutcome,
    toolchainSetupOpen,
    runState,
    sessionId,
    lastDiagnostics,
    lastStderr,
    lastFailed,
    unavailableReason,
    checkCompiler,
    waitForToolchain,
    ensureToolchain,
    dismissToolchainSetup,
    run,
    writeInput,
    stop,
    resize,
  }
}
