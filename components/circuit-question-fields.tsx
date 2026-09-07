"use client"

import { useMemo, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { CircuitQuestionSpec } from "@/lib/engineering-circuit-types"
import { parseCircuitSpec } from "@/lib/engineering-circuit-types"
import {
  parseCircuitStudentAnswer,
  type ParsedCircuitStudentAnswer,
} from "@/lib/circuit-answer-grading"

const MAX_UPLOAD_CHARS = 450_000 // ~330KB base64 — keeps JSON payloads reasonable

function emptyAnswer(
  questionType: string,
  spec: CircuitQuestionSpec,
): ParsedCircuitStudentAnswer {
  const parts: Record<string, { finalAnswer?: string; unit?: string; steps?: string }> = {}
  if (questionType === "circuit_multi_part") {
    for (const sq of spec.subQuestions || []) {
      parts[sq.id] = {}
    }
  }
  const fills: Record<string, string> = {}
  if (questionType === "circuit_fill_equation") {
    for (const k of Object.keys(spec.equationExpected || {})) {
      fills[k] = ""
    }
  }
  return { version: 1, finalAnswer: "", unit: "", steps: "", fills: fills, parts }
}

export function CircuitQuestionFields({
  questionType,
  circuitSpecRaw,
  selectedAnswer,
  onAnswerChange,
  disabled,
  locked,
}: {
  questionType: string
  circuitSpecRaw: unknown
  selectedAnswer: string
  onAnswerChange: (json: string) => void
  disabled?: boolean
  locked?: boolean
}) {
  const spec = useMemo(() => parseCircuitSpec(circuitSpecRaw), [circuitSpecRaw])

  const merged = useMemo(() => {
    const base = emptyAnswer(questionType, spec)
    const cur = parseCircuitStudentAnswer(selectedAnswer || "{}")
    return {
      ...base,
      ...cur,
      fills: { ...base.fills, ...(cur.fills || {}) },
      parts: { ...base.parts, ...(cur.parts || {}) },
    }
  }, [questionType, spec, selectedAnswer])

  const sync = useCallback(
    (patch: Partial<ParsedCircuitStudentAnswer>) => {
      const next: ParsedCircuitStudentAnswer = {
        ...merged,
        ...patch,
        fills: patch.fills ?? merged.fills,
        parts: patch.parts ?? merged.parts,
      }
      onAnswerChange(JSON.stringify(next))
    },
    [merged, onAnswerChange],
  )

  const dl = disabled || locked

  const showFinal =
    questionType !== "circuit_upload_work" &&
    questionType !== "circuit_fill_equation"
  const multipart = questionType === "circuit_multi_part"
  const fillEq = questionType === "circuit_fill_equation"

  return (
    <div className="space-y-5">
      {multipart && (spec.subQuestions || []).length === 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          This multi-part question has no sub-parts configured yet. Tell your instructor to add{" "}
          <code className="text-xs">subQuestions</code> in the Circuits editor.
        </p>
      )}

      {multipart && (spec.subQuestions || []).length > 0 ? (
        <div className="space-y-6">
          {(spec.subQuestions || []).map((sq) => (
            <div
              key={sq.id}
              className="rounded-xl border border-slate-200 dark:border-slate-600 p-4 space-y-3 bg-white/50 dark:bg-slate-800/40"
            >
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {sq.label || `Part ${sq.id}`}
              </p>
              {sq.prompt ? (
                <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{sq.prompt}</p>
              ) : null}
              {(sq.gradeMode === "open" || sq.gradeMode === "numeric" || !sq.gradeMode) && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Final answer {sq.gradeMode !== "open" ? "(numeric when applicable)" : ""}</Label>
                      <Input
                        value={merged.parts?.[sq.id]?.finalAnswer ?? ""}
                        onChange={(e) => {
                          const parts = { ...merged.parts }
                          parts[sq.id] = { ...parts[sq.id], finalAnswer: e.target.value }
                          sync({ parts })
                        }}
                        disabled={dl}
                        placeholder="e.g. 12.5"
                        className="font-mono dark:bg-slate-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <Input
                        value={merged.parts?.[sq.id]?.unit ?? ""}
                        onChange={(e) => {
                          const parts = { ...merged.parts }
                          parts[sq.id] = { ...parts[sq.id], unit: e.target.value }
                          sync({ parts })
                        }}
                        disabled={dl}
                        placeholder="V, A, Ω, W…"
                        className="font-mono dark:bg-slate-900"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Work / reasoning</Label>
                    <Textarea
                      value={merged.parts?.[sq.id]?.steps ?? ""}
                      onChange={(e) => {
                        const parts = { ...merged.parts }
                        parts[sq.id] = { ...parts[sq.id], steps: e.target.value }
                        sync({ parts })
                      }}
                      disabled={dl}
                      rows={4}
                      placeholder="Show KVL/KCL, substitutions, etc."
                      className="dark:bg-slate-900"
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {fillEq ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Fill in each blank (symbol or expression as instructed).
          </p>
          {(Object.keys(spec.equationExpected || {}).length
            ? Object.keys(spec.equationExpected || {})
            : ["term_1"]
          ).map((slot) => (
            <div key={slot} className="space-y-1">
              <Label className="text-xs font-mono">{slot}</Label>
              <Input
                value={merged.fills?.[slot] ?? ""}
                onChange={(e) => {
                  sync({ fills: { ...merged.fills, [slot]: e.target.value } })
                }}
                disabled={dl}
                className="font-mono dark:bg-slate-900"
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs">Overall comments / derivation (optional)</Label>
            <Textarea
              value={merged.steps ?? ""}
              onChange={(e) => sync({ steps: e.target.value })}
              disabled={dl}
              rows={3}
              className="dark:bg-slate-900"
            />
          </div>
        </div>
      ) : null}

      {!multipart && !fillEq && showFinal ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">
              Final answer{spec.requireFinalAnswer === false ? " (optional)" : ""}
            </Label>
            <Input
              value={merged.finalAnswer ?? ""}
              onChange={(e) => sync({ finalAnswer: e.target.value })}
              disabled={dl}
              placeholder="Numeric or symbolic as directed"
              className="font-mono dark:bg-slate-900"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              Unit{spec.requireUnits ? " (required)" : ""}
            </Label>
            <Input
              value={merged.unit ?? ""}
              onChange={(e) => sync({ unit: e.target.value })}
              disabled={dl}
              placeholder="e.g. V, mA, rad/s"
              className="font-mono dark:bg-slate-900"
            />
          </div>
        </div>
      ) : null}

      {(showFinal && !fillEq && !multipart) ||
      questionType === "circuit_upload_work" ||
      (multipart && (spec.subQuestions || []).length === 0) ? (
        <div className="space-y-1">
          <Label className="text-xs">Step-by-step work / explanation</Label>
          <Textarea
            value={merged.steps ?? ""}
            onChange={(e) => sync({ steps: e.target.value })}
            disabled={dl}
            rows={questionType === "circuit_upload_work" ? 5 : 8}
            placeholder="Show your reasoning. Use clear steps so partial credit is possible."
            className="dark:bg-slate-900"
          />
        </div>
      ) : null}

      {(spec.allowWorkUpload === true || questionType === "circuit_upload_work") && (
        <div className="space-y-2">
          <Label className="text-xs">
            {questionType === "circuit_upload_work"
              ? "Upload written work (PDF or image)"
              : "Optional: attach work (photo / scan)"}
          </Label>
          <Input
            type="file"
            accept="image/*,.pdf,application/pdf"
            disabled={dl}
            className="cursor-pointer text-sm"
            onChange={(ev) => {
              const file = ev.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                let data = typeof reader.result === "string" ? reader.result : ""
                if (data.length > MAX_UPLOAD_CHARS) {
                  data = data.slice(0, MAX_UPLOAD_CHARS)
                }
                sync({
                  uploadName: file.name,
                  uploadMime: file.type,
                  uploadDataUrl: data || undefined,
                })
              }
              reader.readAsDataURL(file)
            }}
          />
          {merged.uploadName ? (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Attached: {merged.uploadName}
              {merged.uploadDataUrl ? " (ready)" : ""}
            </p>
          ) : (
            questionType === "circuit_upload_work" && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                This question is graded manually after upload.
              </p>
            )
          )}
        </div>
      )}
    </div>
  )
}
