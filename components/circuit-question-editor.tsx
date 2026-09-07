"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import type { CircuitQuestionSpec } from "@/lib/engineering-circuit-types"
import { defaultCircuitQuestionSpec, parseCircuitSpec } from "@/lib/engineering-circuit-types"

interface Props {
  spec: CircuitQuestionSpec
  onChange: (next: CircuitQuestionSpec) => void
}

export function CircuitQuestionEditor({ spec, onChange }: Props) {
  const s = { ...defaultCircuitQuestionSpec(), ...spec }

  const patch = (p: Partial<CircuitQuestionSpec>) => onChange({ ...s, ...p })

  const givenJson =
    s.givenValues?.length && typeof s.givenValues === "object"
      ? JSON.stringify(s.givenValues, null, 2)
      : "[]"

  const subJson =
    s.subQuestions?.length && typeof s.subQuestions === "object"
      ? JSON.stringify(s.subQuestions, null, 2)
      : "[]"

  const eqJson =
    s.equationExpected && Object.keys(s.equationExpected).length > 0
      ? JSON.stringify(s.equationExpected, null, 2)
      : "{}"

  return (
    <div className="rounded-xl border border-orange-200/70 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-950/25 p-4 space-y-4 mt-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-orange-900 dark:text-orange-100">
        Engineering / Circuits configuration
      </div>

      <p className="text-xs text-orange-800/90 dark:text-orange-200/80">
        Circuit diagrams and PDFs are configured in the <strong>Question diagram / media</strong> panel above
        (shared across all question types).
      </p>

      <div className="space-y-1">
        <Label className="text-xs">givenValues (JSON array)</Label>
        <Textarea
          defaultValue={givenJson}
          key={givenJson.slice(0, 80)}
          onBlur={(e) => {
            try {
              const parsed = JSON.parse(e.target.value)
              if (Array.isArray(parsed)) patch({ givenValues: parsed })
            } catch {
              /* noop */
            }
          }}
          rows={4}
          className="font-mono text-xs"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">expectedAnswer (canonical)</Label>
          <Input
            value={s.expectedAnswer ?? ""}
            onChange={(e) => patch({ expectedAnswer: e.target.value || null })}
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">expectedUnit</Label>
          <Input
            value={s.expectedUnit ?? ""}
            onChange={(e) => patch({ expectedUnit: e.target.value || null })}
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">tolerance (± absolute)</Label>
          <Input
            type="number"
            step="any"
            value={s.tolerance ?? ""}
            onChange={(e) =>
              patch({
                tolerance: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="font-mono text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">acceptedUnits (comma-separated)</Label>
        <Input
          value={(s.acceptedUnits || []).join(", ")}
          onChange={(e) =>
            patch({
              acceptedUnits: e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
          placeholder="W, watts"
          className="text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">solutionRubric</Label>
        <Textarea
          value={s.solutionRubric ?? ""}
          onChange={(e) => patch({ solutionRubric: e.target.value || null })}
          rows={4}
          className="text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">sampleSolution</Label>
        <Textarea
          value={s.sampleSolution ?? ""}
          onChange={(e) => patch({ sampleSolution: e.target.value || null })}
          rows={4}
          className="text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-6 items-center">
        <div className="flex items-center gap-2">
          <Switch checked={!!s.allowWorkUpload} onCheckedChange={(v) => patch({ allowWorkUpload: v })} id="cq-allow-upload" />
          <Label htmlFor="cq-allow-upload" className="text-xs cursor-pointer">
            allowWorkUpload
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={s.requireFinalAnswer !== false} onCheckedChange={(v) => patch({ requireFinalAnswer: v })} id="cq-req-final" />
          <Label htmlFor="cq-req-final" className="text-xs cursor-pointer">
            requireFinalAnswer
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={!!s.requireUnits} onCheckedChange={(v) => patch({ requireUnits: v })} id="cq-req-units" />
          <Label htmlFor="cq-req-units" className="text-xs cursor-pointer">
            requireUnits
          </Label>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">equationExpected (circuit_fill_equation)</Label>
        <Textarea
          defaultValue={eqJson}
          key={eqJson.slice(0, 80)}
          onBlur={(e) => {
            try {
              patch({ equationExpected: JSON.parse(e.target.value || "{}") })
            } catch {
              /* noop */
            }
          }}
          rows={3}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">subQuestions (circuit_multi_part)</Label>
        <Textarea
          defaultValue={subJson}
          key={subJson.slice(0, 120)}
          onBlur={(e) => {
            try {
              const parsed = JSON.parse(e.target.value || "[]")
              if (Array.isArray(parsed)) patch({ subQuestions: parsed })
            } catch {
              /* noop */
            }
          }}
          rows={6}
          className="font-mono text-xs"
        />
      </div>
    </div>
  )
}

export function readCircuitSpecFromQuestion(q: { circuit_spec?: unknown }): CircuitQuestionSpec {
  return parseCircuitSpec(q.circuit_spec)
}
