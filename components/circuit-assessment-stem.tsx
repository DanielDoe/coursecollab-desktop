"use client"

import type { CircuitQuestionSpec } from "@/lib/engineering-circuit-types"
import { parseCircuitSpec } from "@/lib/engineering-circuit-types"
import { formatEngineeringQuestionText } from "@/lib/engineering-question-text"

/** Given-values table for engineering/circuit questions (diagrams use shared Question Media). */
export function CircuitAssessmentStem({ circuitSpecRaw }: { circuitSpecRaw: unknown }) {
  const spec: CircuitQuestionSpec = parseCircuitSpec(circuitSpecRaw)

  if (!spec.givenValues?.length) return null

  return (
    <div className="space-y-4 mb-4">
      {spec.givenValues && spec.givenValues.length > 0 ? (
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-600 overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 px-3 py-2 bg-slate-100/90 dark:bg-slate-800/80 border-b border-slate-200/70 dark:border-slate-600">
            Given values
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600 text-left text-slate-600 dark:text-slate-300">
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 font-medium">Symbol</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                </tr>
              </thead>
              <tbody>
                {spec.givenValues.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/80 last:border-0">
                    <td className="px-3 py-2 text-slate-900 dark:text-slate-100">{row.label}</td>
                    <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200">
                      {formatEngineeringQuestionText(row.symbol ?? "—")}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200">
                      {formatEngineeringQuestionText(row.value ?? "—")}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {formatEngineeringQuestionText(row.unit ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
