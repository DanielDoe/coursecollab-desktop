'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCw,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CC_MODAL_SCRIM, CC_MODAL_SURFACE } from '@/lib/appearance/modal-ui'
import { cn } from '@/lib/utils'
import {
  TOOLCHAIN_SETUP_STEPS,
  toolchainOverallPercent,
  toolchainStepIndex,
  type ToolchainSetupOutcome,
  type ToolchainSetupPhase,
} from '../types/toolchain-setup'

type Props = {
  open: boolean
  outcome: ToolchainSetupOutcome
  phase: ToolchainSetupPhase | null
  message: string | null
  percent: number | null
  compilerLabel: string | null
  errorDetail: string | null
  onRetry: () => void
  onDismiss: () => void
}

function StepIcon({ state }: { state: 'done' | 'active' | 'pending' }) {
  if (state === 'done') {
    return <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--cc-sem-success-text,var(--cc-success))]" aria-hidden />
  }
  if (state === 'active') {
    return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--cc-sem-codebench-text,var(--cc-accent))]" aria-hidden />
  }
  return (
    <Circle
      className="h-5 w-5 shrink-0 text-[var(--cc-text-muted)] opacity-50"
      strokeWidth={1.5}
      aria-hidden
    />
  )
}

export function CodebenchToolchainSetupOverlay({
  open,
  outcome,
  phase,
  message,
  percent,
  compilerLabel,
  errorDetail,
  onRetry,
  onDismiss,
}: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted || typeof document === 'undefined') return null

  const activeIndex = toolchainStepIndex(phase)
  const overall = outcome === 'success' ? 100 : toolchainOverallPercent(phase, percent)
  const isError = outcome === 'error'
  const isSuccess = outcome === 'success'

  const headline = isSuccess
    ? 'Your C++ compiler is ready'
    : isError
      ? 'We need a moment more'
      : 'Setting up your C++ environment'

  const subhead = isSuccess
    ? compilerLabel
      ? `${compilerLabel} is configured — you can run and submit code now.`
      : 'Everything checked out — you can run code now.'
    : isError
      ? 'CourseCollab could not finish setup automatically.'
      : 'Sit back and relax — we are switching or installing the compiler for you.'

  const liveMessage =
    message?.trim() ||
    (phase === 'downloading' ? 'Downloading…' : 'Preparing CodeBench on this computer…')

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="codebench-toolchain-setup"
          className={cn(CC_MODAL_SCRIM, 'z-[200] flex items-center justify-center p-4 sm:p-8')}
          role="dialog"
          aria-modal="true"
          aria-labelledby="codebench-toolchain-setup-title"
          aria-describedby="codebench-toolchain-setup-desc"
          aria-busy={outcome === 'active'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              CC_MODAL_SURFACE,
              'relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] shadow-2xl',
            )}
            data-codebench-toolchain-setup=""
          >
            <div className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-sem-codebench-soft,var(--muted))_55%,transparent)] px-5 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
                    'border-[var(--cc-sem-codebench-border,var(--border))]',
                    'bg-[var(--cc-sem-codebench-soft,var(--muted))] text-[var(--cc-sem-codebench-text,var(--cc-accent))]',
                  )}
                >
                  {isSuccess ? (
                    <CheckCircle2 className="h-6 w-6" aria-hidden />
                  ) : isError ? (
                    <Wrench className="h-6 w-6" aria-hidden />
                  ) : (
                    <Sparkles className="h-6 w-6" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2
                    id="codebench-toolchain-setup-title"
                    className="text-lg font-semibold leading-snug text-[var(--cc-text,var(--foreground))]"
                  >
                    {headline}
                  </h2>
                  <p
                    id="codebench-toolchain-setup-desc"
                    className="mt-1 text-sm leading-relaxed text-[var(--cc-text-secondary,var(--cc-text))]"
                  >
                    {subhead}
                  </p>
                </div>
                {isError ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)]"
                    onClick={onDismiss}
                    aria-label="Close setup dialog"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-6">
              {!isError && !isSuccess ? (
                <>
                  <div className="space-y-2" aria-live="polite">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium text-[var(--cc-text)]">Overall progress</span>
                      <span className="text-sm font-semibold tabular-nums text-[var(--cc-text)]">{overall}%</span>
                    </div>
                    <Progress value={overall} className="h-2.5" />
                    <p className="text-sm text-[var(--cc-text-secondary,var(--cc-text))]">{liveMessage}</p>
                  </div>

                  <ol className="space-y-2" aria-label="Setup steps">
                    {TOOLCHAIN_SETUP_STEPS.map((step, index) => {
                      const state =
                        index < activeIndex
                          ? 'done'
                          : index === activeIndex && outcome === 'active'
                            ? 'active'
                            : 'pending'
                      return (
                        <li
                          key={step.phase}
                          className={cn(
                            'flex gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                            state === 'active'
                              ? 'border-[var(--cc-sem-codebench-border,var(--border))] bg-[var(--cc-sem-codebench-soft,var(--muted))]/80'
                              : 'border-[var(--border)] bg-[var(--cc-ui-surface-muted,var(--muted))]/40',
                          )}
                        >
                          <StepIcon state={state} />
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                'text-sm font-medium',
                                state === 'pending'
                                  ? 'text-[var(--cc-text-muted)]'
                                  : 'text-[var(--cc-text)]',
                              )}
                            >
                              {step.title}
                            </p>
                            <p className="mt-0.5 text-xs leading-relaxed text-[var(--cc-text-secondary,var(--cc-text))]">
                              {step.detail}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ol>

                  <p className="text-center text-xs text-[var(--cc-text-muted)]">
                    Please keep CourseCollab open. This usually takes one to three minutes on first setup.
                  </p>
                </>
              ) : null}

              {isSuccess ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center" aria-live="polite">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--cc-sem-success-soft,var(--muted))] text-[var(--cc-sem-success-text,var(--cc-success))]">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <p className="text-sm text-[var(--cc-text-secondary,var(--cc-text))]">
                    Opening your editor…
                  </p>
                </div>
              ) : null}

              {isError ? (
                <div className="space-y-4" aria-live="assertive">
                  <p className="text-sm leading-relaxed text-[var(--cc-text-secondary,var(--cc-text))]">
                    {errorDetail ||
                      'Try again with a stable connection. You can also install g++ or LLVM yourself, then click Retry.'}
                  </p>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" onClick={onDismiss} className="text-[var(--cc-text)]">
                      Continue without local run
                    </Button>
                    <Button type="button" onClick={onRetry} className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Retry setup
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
