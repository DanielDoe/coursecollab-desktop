"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react"
import { Loader2, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { ProgramTerminal } from "@/src/features/codebench/components/Terminal"
import { CodebenchToolchainSetupOverlay } from "@/src/features/codebench/components/CodebenchToolchainSetupOverlay"
import { useCodeRunner } from "@/src/features/codebench/hooks/useCodeRunner"
import { cn } from "@/lib/utils"

type LiveInstructorRunTerminalApi = {
  write: (text: string) => void
  clear: () => void
  fit: () => void
}

export type LiveInstructorRunPanelHandle = {
  run: (sourceCode: string) => Promise<void>
}

type Props = {
  className?: string
  studentName: string
  onClose: () => void
  onTerminalReady?: () => void
  onBusyChange?: (busy: boolean) => void
}

function compilerDisplayName(compiler: { compiler?: string | null } | null | undefined) {
  if (!compiler?.compiler) return "C++"
  if (compiler.compiler === "zig") return "C++"
  return compiler.compiler
}

export const LiveInstructorRunPanel = forwardRef<LiveInstructorRunPanelHandle, Props>(
  function LiveInstructorRunPanel(
    { className, studentName, onClose, onTerminalReady, onBusyChange },
    ref,
  ) {
    const { isDark } = useAppearance()
    const terminalApi = useRef<LiveInstructorRunTerminalApi | null>(null)
    const hostRef = useRef<HTMLDivElement | null>(null)

    const write = useCallback((text: string) => {
      terminalApi.current?.write(text)
    }, [])

    const runner = useCodeRunner({ onWrite: write })

    const run = useCallback(
      async (sourceCode: string) => {
        for (let i = 0; i < 40; i++) {
          if (terminalApi.current) break
          await new Promise((r) => window.setTimeout(r, 50))
        }
        terminalApi.current?.clear()

        if (!runner.available) {
          write(
            "\r\nLocal C++ run is only available in the CourseCollab desktop app (or Vite dev on port 5173).\r\n",
          )
          return
        }

        // Do not call detect-only checkCompiler here. It can finish after a
        // successful install/warmup and paint "Compiler not found".
        let compilerInfo = runner.compiler
        if (runner.checking || runner.installing || !compilerInfo) {
          write("\r\nWaiting for the C++ compiler…\r\n")
          compilerInfo = (await runner.waitForToolchain()) ?? compilerInfo
        }
        if (!compilerInfo?.available) {
          write("\r\nLooking for a C++ compiler…\r\n")
          compilerInfo = (await runner.ensureToolchain()) ?? compilerInfo
        }
        if (!compilerInfo?.available) {
          write(
            `\r\n${compilerInfo?.setupGuidance || runner.unavailableReason || "Compiler not found. CourseCollab could not find a C++ compiler on this computer."}\r\n`,
          )
          return
        }

        await runner.run(sourceCode)
      },
      [
        runner.available,
        runner.waitForToolchain,
        runner.checking,
        runner.compiler,
        runner.installing,
        runner.ensureToolchain,
        runner.run,
        runner.unavailableReason,
        write,
      ],
    )

    useImperativeHandle(ref, () => ({ run }), [run])

    const handleReady = useCallback(
      (api: LiveInstructorRunTerminalApi) => {
        terminalApi.current = api
        requestAnimationFrame(() => api.fit())
        onTerminalReady?.()
      },
      [onTerminalReady],
    )

    useEffect(() => {
      return () => {
        terminalApi.current = null
      }
    }, [])

    useEffect(() => {
      const host = hostRef.current
      if (!host) return
      const observer = new ResizeObserver(() => {
        terminalApi.current?.fit()
      })
      observer.observe(host)
      return () => observer.disconnect()
    }, [])

    const busy =
      runner.runState === "compiling" ||
      runner.runState === "running" ||
      runner.runState === "stopping" ||
      runner.checking ||
      runner.installing

    useEffect(() => {
      onBusyChange?.(busy)
    }, [busy, onBusyChange])

    const status = runner.installing
      ? runner.installProgress != null
        ? `Installing C++ compiler… ${runner.installProgress}%`
        : runner.installMessage || "Installing C++ compiler…"
      : runner.checking
        ? "Checking compiler…"
        : !runner.available
          ? "Local run unavailable"
          : !runner.compiler?.available
            ? "Compiler not found"
            : runner.runState === "compiling"
              ? "Compiling main.cpp…"
              : runner.runState === "running"
                ? "Running…"
                : runner.runState === "stopping"
                  ? "Stopping…"
                  : `${compilerDisplayName(runner.compiler)} ready`

    return (
      <>
        <CodebenchToolchainSetupOverlay
          open={runner.toolchainSetupOpen}
          outcome={runner.setupOutcome === "hidden" ? "active" : runner.setupOutcome}
          phase={runner.toolchainPhase}
          message={runner.installMessage}
          percent={runner.installProgress}
          compilerLabel={runner.compiler?.available ? compilerDisplayName(runner.compiler) : null}
          errorDetail={runner.unavailableReason}
          onRetry={() => void runner.ensureToolchain()}
          onDismiss={runner.dismissToolchainSetup}
        />
        <section
          className={cn(
            "live-instructor-run-panel flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--cc-background)]",
            className,
          )}
          aria-label="Program output"
        >
          <div className="flex shrink-0 items-center justify-end gap-1 border-b border-[var(--border)] px-2 py-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] text-[var(--cc-text-muted)]"
              onClick={onClose}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Close
            </Button>
          </div>
          <div ref={hostRef} className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] font-mono shadow-[0_8px_24px_color-mix(in_srgb,var(--cc-text)_8%,transparent)]">
              <div className="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--muted)] px-2.5 text-[var(--cc-text-muted)]">
                <div className="flex shrink-0 items-center gap-1.5" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ee411a] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.25)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f5c542] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.2)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#3ccb5a] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.2)]" />
                </div>
                <p className="min-w-0 flex-1 truncate text-center text-[11px] font-medium tracking-tight text-[var(--cc-text-muted)]">
                  student@codebench
                  <span className="mx-1 text-[var(--cc-accent)]">~</span>
                  <span className="text-[var(--cc-text-secondary)]" title={studentName}>
                    {compilerDisplayName(runner.compiler)}
                  </span>
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className={cn(
                      "inline-flex max-w-[10rem] items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-wide",
                      busy ? "text-[var(--cc-accent)]" : "text-[var(--cc-success)]",
                    )}
                  >
                    {busy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : null}
                    <span className="truncate normal-case tracking-normal">{status}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-[10px] text-[var(--cc-text-muted)] hover:bg-[var(--card)] hover:text-[var(--cc-text)]"
                    onClick={() => terminalApi.current?.clear()}
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 px-2 pb-2 pt-1">
                <ProgramTerminal
                  isDark={isDark}
                  acceptInput={runner.runState === "running" && runner.available && Boolean(runner.sessionId)}
                  onInput={(data) => void runner.writeInput(data)}
                  onReady={handleReady}
                />
              </div>
            </div>
          </div>
        </section>
      </>
    )
  },
)
