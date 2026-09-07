import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import type { StudioDiagnostic } from '@/lib/codebench-compiler-diagnostics'
import type { CodeBenchRunResult } from '../hooks/useCodeRunner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCodeRunner } from '../hooks/useCodeRunner'
import { ProgramTerminal } from './Terminal'
import type { CodeBenchRunState } from '../types/codebench'

export type CodeBenchExecutionHandle = {
  run: (sourceCode: string) => Promise<void>
  stop: () => Promise<void>
  clear: () => void
}

export type CodeBenchExecutionMeta = {
  available: boolean
  checking: boolean
  runState: CodeBenchRunState
  compilerLabel: string | null
  compilerReady: boolean
  unavailableReason: string | null
}

type Props = {
  theme: 'light' | 'dark'
  canExecute: boolean
  unsupportedMessage?: string
  onMetaChange?: (meta: CodeBenchExecutionMeta) => void
  onRunResult?: (result: CodeBenchRunResult) => void
  onSuggestFix?: (payload: { stderr: string; diagnostics: StudioDiagnostic[] }) => void
}

type TerminalApi = {
  write: (text: string) => void
  clear: () => void
  fit: () => { cols: number; rows: number }
}

const HEIGHT_STORAGE_KEY = 'codebench_terminal_height'
const MIN_DOCK_HEIGHT = 44
const DEFAULT_DOCK_HEIGHT = 168
const MIN_EDITOR_HEIGHT = 180
const COLLAPSED_HEIGHT = 40

function readStoredHeight() {
  if (typeof window === 'undefined') return DEFAULT_DOCK_HEIGHT
  const raw = Number(window.localStorage.getItem(HEIGHT_STORAGE_KEY))
  if (!Number.isFinite(raw)) return DEFAULT_DOCK_HEIGHT
  if (raw === MIN_DOCK_HEIGHT) return DEFAULT_DOCK_HEIGHT
  return Math.round(Math.max(MIN_DOCK_HEIGHT, Math.min(720, raw)))
}

function persistHeight(height: number) {
  try {
    window.localStorage.setItem(HEIGHT_STORAGE_KEY, String(height))
  } catch {
    // ignore quota / private mode
  }
}

function compilerDisplayName(compiler: { compiler?: string | null } | null | undefined) {
  if (!compiler?.compiler) return 'C++'
  if (compiler.compiler === 'zig') return 'C++'
  return compiler.compiler
}

function clampDockHeight(next: number, parentHeight: number) {
  const bounded = Math.round(Math.max(MIN_DOCK_HEIGHT, Math.min(720, next)))
  if (parentHeight < MIN_EDITOR_HEIGHT + MIN_DOCK_HEIGHT + 48) return bounded
  return Math.min(bounded, parentHeight - MIN_EDITOR_HEIGHT)
}

export const CodeBenchExecutionDock = forwardRef<CodeBenchExecutionHandle, Props>(
  function CodeBenchExecutionDock({ theme, canExecute, unsupportedMessage, onMetaChange, onRunResult, onSuggestFix }, ref) {
    const isDark = theme === 'dark'
    const terminalApi = useRef<TerminalApi | null>(null)
    const dockRef = useRef<HTMLElement | null>(null)
    const heightRef = useRef(DEFAULT_DOCK_HEIGHT)
    const lastExpandedRef = useRef(DEFAULT_DOCK_HEIGHT)
    const [height, setHeight] = useState(DEFAULT_DOCK_HEIGHT)
    const [dragging, setDragging] = useState(false)
    heightRef.current = height
    if (height > COLLAPSED_HEIGHT + 8) lastExpandedRef.current = height

    const applyHeight = useCallback((next: number, persist = false) => {
      const parentHeight = dockRef.current?.parentElement?.clientHeight ?? 640
      const clamped = clampDockHeight(next, parentHeight)
      heightRef.current = clamped
      setHeight(clamped)
      if (persist) persistHeight(clamped)
      requestAnimationFrame(() => terminalApi.current?.fit())
    }, [])

    useEffect(() => {
      const stored = readStoredHeight()
      heightRef.current = stored
      if (stored > COLLAPSED_HEIGHT + 8) lastExpandedRef.current = stored
      applyHeight(stored)
    }, [applyHeight])

    useEffect(() => {
      const parent = dockRef.current?.parentElement
      if (!parent) return
      const observer = new ResizeObserver(() => applyHeight(heightRef.current))
      observer.observe(parent)
      return () => observer.disconnect()
    }, [applyHeight])

    const onResizePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        const startY = event.clientY
        const startHeight = heightRef.current
        setDragging(true)
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'ns-resize'

        const onMove = (moveEvent: PointerEvent) => {
          applyHeight(startHeight + (startY - moveEvent.clientY))
        }
        const onUp = () => {
          setDragging(false)
          document.body.style.userSelect = ''
          document.body.style.cursor = ''
          persistHeight(heightRef.current)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
      },
      [applyHeight],
    )

    const onResizeDoubleClick = useCallback(() => {
      if (heightRef.current <= COLLAPSED_HEIGHT + 8) {
        applyHeight(lastExpandedRef.current || DEFAULT_DOCK_HEIGHT, true)
      } else {
        lastExpandedRef.current = heightRef.current
        applyHeight(COLLAPSED_HEIGHT, true)
      }
    }, [applyHeight])

    const write = useCallback((text: string) => {
      terminalApi.current?.write(text)
    }, [])

    const runner = useCodeRunner({ onWrite: write, onRunResult })

    const meta = useMemo<CodeBenchExecutionMeta>(
      () => ({
        available: runner.available,
        checking: runner.checking,
        runState: runner.runState,
        compilerLabel: runner.compiler?.available ? compilerDisplayName(runner.compiler) : null,
        compilerReady: Boolean(runner.compiler?.available),
        unavailableReason: runner.unavailableReason,
      }),
      [
        runner.available,
        runner.checking,
        runner.compiler?.available,
        runner.compiler?.compiler,
        runner.runState,
        runner.unavailableReason,
      ],
    )

    useEffect(() => {
      onMetaChange?.(meta)
    }, [meta, onMetaChange])

    const handleReady = useCallback((api: TerminalApi) => {
      terminalApi.current = api
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        run: async (sourceCode: string) => {
          terminalApi.current?.clear()
          if (!canExecute) {
            write(`\r\n${unsupportedMessage || 'Local run currently supports C++. Switch the language to C++.'}\r\n`)
            return
          }
          if (!runner.compiler?.available) {
            write('\r\nLooking for a C++ compiler…\r\n')
            const installed = await runner.ensureToolchain()
            if (!installed?.available) {
              write('\r\nCompiler not found. CourseCollab could not install one on this computer.\r\n')
              if (runner.unavailableReason) write(`${runner.unavailableReason}\r\n`)
              return
            }
          }
          await runner.run(sourceCode)
        },
        stop: () => runner.stop(),
        clear: () => terminalApi.current?.clear(),
      }),
      [canExecute, runner, unsupportedMessage, write],
    )

    const busy =
      runner.runState === 'compiling' ||
      runner.runState === 'running' ||
      runner.runState === 'stopping' ||
      runner.checking ||
      runner.installing
    const status = runner.installing
      ? runner.installProgress != null
        ? `Installing C++ compiler… ${runner.installProgress}%`
        : runner.installMessage || 'Installing C++ compiler…'
      : runner.checking
        ? 'Checking compiler…'
        : !runner.compiler?.available
          ? 'Compiler not found'
          : runner.runState === 'compiling'
            ? 'Compiling main.cpp…'
            : runner.runState === 'running'
              ? 'Running…'
              : runner.runState === 'stopping'
                ? 'Stopping…'
                : `${compilerDisplayName(runner.compiler)} ready`

    const host = compilerDisplayName(runner.compiler)
    const collapsed = height <= COLLAPSED_HEIGHT + 8

    return (
      <section
        ref={dockRef}
        style={{ height }}
        className="flex shrink-0 flex-col overflow-hidden border-t border-[var(--border)] bg-[var(--cc-background)]"
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize terminal"
          aria-valuemin={MIN_DOCK_HEIGHT}
          aria-valuemax={720}
          aria-valuenow={height}
          tabIndex={0}
          title="Drag to resize · double-click to collapse"
          className={cn(
            'group flex h-2.5 shrink-0 cursor-ns-resize items-center justify-center touch-none',
            dragging ? 'bg-[var(--cc-accent)]/15' : 'bg-transparent',
          )}
          onPointerDown={onResizePointerDown}
          onDoubleClick={onResizeDoubleClick}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              applyHeight(height + 24, true)
            } else if (event.key === 'ArrowDown') {
              event.preventDefault()
              applyHeight(height - 24, true)
            }
          }}
        >
          <span
            className={cn(
              'h-1 w-10 rounded-full transition-colors',
              dragging
                ? 'bg-[var(--cc-accent)]'
                : 'bg-[color-mix(in_srgb,var(--cc-text)_22%,transparent)] group-hover:bg-[var(--cc-accent)]',
            )}
          />
          <span className="sr-only">Resize terminal</span>
        </div>
        <div className="mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] font-mono shadow-[0_8px_24px_color-mix(in_srgb,var(--cc-text)_8%,transparent)]">
          <div
            className="flex h-8 shrink-0 cursor-ns-resize items-center gap-2 border-b border-[var(--border)] bg-[var(--muted)] px-2.5 text-[var(--cc-text-muted)]"
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest('button')) return
              onResizePointerDown(event)
            }}
            onDoubleClick={(event) => {
              if ((event.target as HTMLElement).closest('button')) return
              onResizeDoubleClick()
            }}
          >
            <div className="flex shrink-0 items-center gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-[#ee411a] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.25)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#f5c542] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.2)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#3ccb5a] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.2)]" />
            </div>
            <p className="min-w-0 flex-1 truncate text-center text-[11px] font-medium tracking-tight text-[var(--cc-text-muted)]">
              student@codebench
              <span className="mx-1 text-[var(--cc-accent)]">~</span>
              <span className="text-[var(--cc-text-secondary)]">{host}</span>
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <span
                className={cn(
                  'inline-flex max-w-[9.5rem] items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-wide',
                  busy ? 'text-[var(--cc-accent)]' : 'text-[var(--cc-success)]',
                )}
              >
                {busy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : null}
                <span className="truncate normal-case tracking-normal">{status}</span>
              </span>
              {runner.lastFailed && onSuggestFix && !busy ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px] text-[var(--cc-accent)] hover:bg-[var(--card)] hover:text-[var(--cc-accent)]"
                  onClick={() =>
                    onSuggestFix({
                      stderr: runner.lastStderr,
                      diagnostics: runner.lastDiagnostics,
                    })
                  }
                >
                  <Sparkles className="h-3 w-3" />
                  Suggest fix
                </Button>
              ) : null}
              {!runner.compiler?.available && !runner.checking && !runner.installing ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn(
                    'h-6 px-1.5 text-[10px]',
                    'text-[var(--cc-text-muted)] hover:bg-[var(--card)] hover:text-[var(--cc-text)]',
                  )}
                  onClick={() => void (runner.compiler?.canInstall ? runner.ensureToolchain() : runner.checkCompiler())}
                >
                  <RefreshCw className="h-3 w-3" />
                  {runner.compiler?.canInstall ? 'Install' : 'Check'}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  'h-6 px-1.5 text-[10px]',
                  'text-[var(--cc-text-muted)] hover:bg-[var(--card)] hover:text-[var(--cc-text)]',
                )}
                onClick={() => terminalApi.current?.clear()}
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </Button>
            </div>
          </div>
          <div className={cn('min-h-0 flex-1 px-2 pb-2 pt-1', collapsed && 'hidden')}>
            <ProgramTerminal
              isDark={isDark}
              acceptInput={runner.runState === 'running'}
              onInput={(data) => void runner.writeInput(data)}
              onReady={handleReady}
            />
          </div>
        </div>
      </section>
    )
  },
)
