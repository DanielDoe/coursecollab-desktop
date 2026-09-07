"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type WizardFieldState = {
  studentStrengths: string
  achievements: string
  projects: string
  skills: string
  leadershipExamples: string
  goals: string
  specialInstructions: string
  letterFor: string
  classExperience: string
  personalQualities: string
}

type StepDef =
  | { key: string; title: string; hint: string; field: keyof WizardFieldState; multiline: true; optional?: boolean }
  | { key: string; title: string; hint: string; tone: true }

export const WIZARD_STEPS_AI: StepDef[] = [
  {
    key: "strengths",
    title: "Academic strengths",
    hint: "What stands out academically — coursework, mastery, curiosity?",
    field: "studentStrengths",
    multiline: true,
  },
  {
    key: "projects",
    title: "Project or experience you’re proud of",
    hint: "One accomplishment that shows how you tackle real work.",
    field: "projects",
    multiline: true,
  },
  {
    key: "skills",
    title: "Technical or professional skills",
    hint: "Tools, disciplines, certifications worth highlighting.",
    field: "skills",
    multiline: true,
  },
  {
    key: "leadership",
    title: "Leadership / teamwork examples",
    hint: "How you collaborate or lead peers or projects.",
    field: "leadershipExamples",
    multiline: true,
  },
  {
    key: "goals",
    title: "Goal this letter supports",
    hint: "What program, internship, scholarship, or job is this aiming at?",
    field: "goals",
    multiline: true,
  },
  {
    key: "achievements",
    title: "Awards & context (optional)",
    hint: "GPA bands, accolades, extracurricular threads — omit what doesn’t matter.",
    field: "achievements",
    multiline: true,
    optional: true,
  },
  {
    key: "tone",
    title: "Preferred tone",
    hint: "",
    tone: true,
  },
  {
    key: "extras",
    title: "Anything else for your instructor?",
    hint: "Optional nuance — voice, exclusions, sensitivities.",
    field: "specialInstructions",
    multiline: true,
    optional: true,
  },
]

type Props = {
  accentClassName?: string
  fields: WizardFieldState
  patchFields: (patch: Partial<WizardFieldState>) => void
  tone: string
  setTone: (t: string) => void
  requireResume?: boolean
  requireTranscript?: boolean
  busy: boolean
  allowAiAfter: boolean
  onFinish: () => void
  /** Return to the two-card intake (questions vs. own draft). */
  onBackToChoices?: () => void
  choicesBusy?: boolean
}

export function LetterQuestionnaireWizard({
  accentClassName,
  fields,
  patchFields,
  tone,
  setTone,
  requireResume,
  requireTranscript,
  busy,
  allowAiAfter,
  onFinish,
  onBackToChoices,
  choicesBusy,
}: Props) {
  const [step, setStep] = useState(0)
  const [resumePicked, setResumePicked] = useState(false)
  const [transcriptPicked, setTranscriptPicked] = useState(false)

  const fileStepsOffset = requireResume || requireTranscript ? 1 : 0
  const lastIndex = WIZARD_STEPS_AI.length - 1 + fileStepsOffset
  const isFileStep = requireResume || requireTranscript ? step === WIZARD_STEPS_AI.length : false

  const stepDef = !isFileStep ? WIZARD_STEPS_AI[step] : null

  const canNext = useMemo(() => {
    if (isFileStep) {
      if (requireResume && !resumePicked) return false
      if (requireTranscript && !transcriptPicked) return false
      return true
    }
    if (!stepDef) return false
    if ("tone" in stepDef && stepDef.tone) return tone.trim().length > 0
    if ("field" in stepDef) {
      if (stepDef.optional) return true
      const raw = String(fields[stepDef.field] ?? "")
      return raw.trim().length > 0
    }
    return false
  }, [
    isFileStep,
    stepDef,
    tone,
    fields,
    requireResume,
    requireTranscript,
    resumePicked,
    transcriptPicked,
  ])

  function goNext() {
    if (!canNext) return
    if (step < lastIndex) setStep((s) => s + 1)
    else void onFinish()
  }

  function goBack() {
    if (step > 0) setStep((s) => s - 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Your details</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            One prompt at a time — {step + 1} of {lastIndex + 1}
          </p>
        </div>
        <div className="h-1.5 flex-1 min-w-[120px] max-w-[200px] rounded-full bg-slate-200/80 dark:bg-white/[0.08] overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              accentClassName ?? "bg-sky-600 dark:bg-sky-500",
            )}
            animate={{ width: `${((step + 1) / (lastIndex + 1)) * 100}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>
      </div>

      <div className="relative min-h-[200px] sm:min-h-[220px]">
        <AnimatePresence mode="wait" initial={false}>
          {isFileStep ? (
            <motion.div
              key="files"
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="space-y-4"
            >
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Your instructor requires these uploads before continuing.
              </p>
              {requireResume ? (
                <div className="space-y-2">
                  <Label htmlFor="resume">Resume upload</Label>
                  <Input
                    id="resume"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    required
                    onChange={(e) => setResumePicked(Boolean(e.target.files?.[0]))}
                    className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/45 text-slate-900 dark:text-slate-100 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:px-3 file:py-2 file:text-sm"
                  />
                </div>
              ) : null}
              {requireTranscript ? (
                <div className="space-y-2">
                  <Label htmlFor="transcript">Transcript upload</Label>
                  <Input
                    id="transcript"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    required
                    onChange={(e) => setTranscriptPicked(Boolean(e.target.files?.[0]))}
                    className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/45 text-slate-900 dark:text-slate-100 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:px-3 file:py-2 file:text-sm"
                  />
                </div>
              ) : null}
            </motion.div>
          ) : stepDef && "tone" in stepDef && stepDef.tone ? (
            <motion.div
              key="tone"
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 }}
              transition={{ duration: 0.26, ease: "easeOut" }}
              className="space-y-3"
            >
              <div>
                <Label htmlFor="wiz-tone">{stepDef.title}</Label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  e.g. professional, warm, research-focused…
                </p>
              </div>
              <Input
                id="wiz-tone"
                required
                className="rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/45 text-slate-900 dark:text-slate-100"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="professional"
              />
            </motion.div>
          ) : stepDef && "field" in stepDef ? (
            <motion.div
              key={stepDef.key}
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 }}
              transition={{ duration: 0.26, ease: "easeOut" }}
              className="space-y-3"
            >
              <div>
                <Label htmlFor={`wiz-${stepDef.key}`}>{stepDef.title}</Label>
                {stepDef.hint ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{stepDef.hint}</p>
                ) : null}
              </div>
              <Textarea
                id={`wiz-${stepDef.key}`}
                required={"optional" in stepDef ? !stepDef.optional : true}
                className={cn(
                  "rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/45 text-slate-900 dark:text-slate-100",
                  "min-h-[132px] sm:min-h-[140px] text-sm leading-relaxed",
                )}
                value={String(fields[stepDef.field] ?? "")}
                onChange={(e) =>
                  patchFields({ [stepDef.field]: e.target.value } as Partial<WizardFieldState>)
                }
                placeholder="Type your answer here…"
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div
        className={cn(
          "flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:gap-4",
          onBackToChoices ? "sm:justify-between" : "sm:justify-end",
        )}
      >
        {onBackToChoices ? (
          <Button
            type="button"
            variant="ghost"
            className="rounded-xl gap-2 -ml-2 self-start text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            disabled={busy || choicesBusy}
            onClick={() => onBackToChoices()}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back to options
          </Button>
        ) : null}
        <div
          className={cn(
            "flex items-center justify-end gap-2",
            onBackToChoices ? "w-full sm:w-auto" : "w-full",
          )}
        >
          <Button
            type="button"
            variant="outline"
            className="rounded-xl gap-2 border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-200"
            disabled={busy || step === 0}
            onClick={() => goBack()}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </Button>
          <Button
            type="button"
            className={cn(
              "rounded-xl gap-2 min-w-[8.5rem] bg-sky-600 hover:bg-sky-700",
              allowAiAfter && step === lastIndex ? "bg-emerald-600 hover:bg-emerald-700" : "",
            )}
            disabled={busy || !canNext}
            onClick={() => goNext()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
            ) : step === lastIndex ? (
              <>Finish {!allowAiAfter ? "& continue" : ""}</>
            ) : (
              <>
                Continue
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </>
            )}
          </Button>
        </div>
      </div>
      {step === lastIndex && allowAiAfter ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/70 dark:border-white/[0.08] pt-3">
          After you finish, we&apos;ll briefly prepare AI drafts — stay on this page for the loading step.
        </p>
      ) : null}
    </div>
  )
}
