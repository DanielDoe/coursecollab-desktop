"use client"

import { motion } from "framer-motion"
import { AlertCircle, TriangleAlert } from "lucide-react"

export function hasIntegritySignals(results: any): boolean {
  if (!results) return false
  return !!(
    results.auto_submitted ||
    results.violation_reason ||
    (results.tab_switch_count ?? 0) > 0 ||
    (results.copy_paste_attempts ?? 0) > 0 ||
    (results.mouse_leave_count ?? 0) > 0 ||
    results.violation_log ||
    (results.gemini_strikes_count ?? 0) > 0
  )
}

function formatViolationTypeLabel(type: string): string {
  const t = type.replace(/_/g, " ").trim() || "event"
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Aggregates `violation_log` by `type` — one chip per type with count (no per-event detail). */
function ViolationLogTypeCounts({ results }: { results: any }) {
  const log = results?.violation_log
  if (!Array.isArray(log) || log.length === 0) return null
  const counts = new Map<string, number>()
  for (const e of log) {
    const t = String(e?.type ?? "event").trim() || "event"
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  const entries = [...counts.entries()]
  if (entries.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {entries.map(([type, n]) => (
        <span
          key={type}
          className="px-2 py-0.5 text-xs rounded-full bg-slate-100/90 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-600/60"
        >
          {formatViolationTypeLabel(type)}: {n}
        </span>
      ))}
    </div>
  )
}

type Variant = "standalone" | "embedded"

/**
 * Anti-cheat / integrity UI for quiz results. Use `embedded` inside the student “Grading complete” card;
 * `standalone` for pending student view or instructor report.
 */
export function StudentIntegrityBehaviorRecord({
  results,
  variant = "standalone",
}: {
  results: any
  variant?: Variant
}) {
  const embedded = variant === "embedded"

  const hasStalled =
    results.violation_log &&
    Array.isArray(results.violation_log) &&
    results.violation_log.some((e: any) => e.type === "submission_stalled")
  const isSevere =
    results.auto_submitted ||
    results.violation_reason ||
    hasStalled ||
    (results.gemini_strikes_count && results.gemini_strikes_count >= 5) ||
    (results.tab_switch_count ?? 0) > 5 ||
    (results.copy_paste_attempts ?? 0) > 3 ||
    (results.mouse_leave_count ?? 0) > 10

  if (!isSevere) {
    return (
      <div className="space-y-0">
        <div
          className={
            embedded
              ? "w-full flex flex-wrap items-start sm:items-center gap-2 px-3 py-2.5 rounded-lg border border-amber-200/80 dark:border-amber-700/50 bg-amber-50/70 dark:bg-amber-900/25"
              : "mt-4 flex flex-wrap items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/20 max-w-xl mx-auto"
          }
        >
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-sm text-amber-800 dark:text-amber-200">
            Minor behavioral flags logged for review
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {results.gemini_strikes_count > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300">
                AI: {results.gemini_strikes_count}
              </span>
            )}
            {results.tab_switch_count > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300">
                Tabs: {results.tab_switch_count}
              </span>
            )}
            {results.copy_paste_attempts > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300">
                Copy: {results.copy_paste_attempts}
              </span>
            )}
            {results.mouse_leave_count > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300">
                Mouse: {results.mouse_leave_count}
              </span>
            )}
          </div>
          <div className="w-full basis-full">
            <ViolationLogTypeCounts results={results} />
          </div>
        </div>
      </div>
    )
  }

  const severeShell =
    embedded
      ? `w-full max-w-none mx-0 p-4 sm:p-5 rounded-xl`
      : `mt-6 p-6 mx-auto max-w-2xl rounded-2xl`

  return (
    <div className="space-y-0">
      <div
        className={`${severeShell} relative overflow-hidden ${
          (results.auto_submitted || results.violation_reason) && !hasStalled
            ? "bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 dark:from-red-900/30 dark:via-orange-900/30 dark:to-amber-900/30 border-2 border-red-400 dark:border-red-600 shadow-lg"
            : "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-300 dark:border-amber-700"
        }`}
      >
        <div className="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-32 h-32 bg-red-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-orange-400 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            {(results.auto_submitted || results.violation_reason) &&
            !(
              results.violation_log &&
              Array.isArray(results.violation_log) &&
              results.violation_log.some((e: any) => e.type === "submission_stalled")
            ) ? (
              <>
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.1, 1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="text-4xl"
                >
                  ⚠️
                </motion.div>
                <span
                  className={`font-bold text-xl ${
                    results.auto_submitted || results.violation_reason
                      ? "text-red-700 dark:text-red-300"
                      : "text-amber-700 dark:text-amber-300"
                  }`}
                >
                  Auto-Submitted Assessment
                </span>
                <motion.div
                  animate={{ rotate: [0, 10, -10, 10, -10, 0], scale: [1, 1.1, 1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                  className="text-4xl"
                >
                  🚨
                </motion.div>
              </>
            ) : results.violation_log &&
              Array.isArray(results.violation_log) &&
              results.violation_log.some((e: any) => e.type === "submission_stalled") ? (
              <>
                <TriangleAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                <span className="font-bold text-xl text-amber-700 dark:text-amber-300">
                  Submission Issue – Flagged for Instructor
                </span>
              </>
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`text-base text-center ${
              (results.auto_submitted || results.violation_reason) &&
              !(
                results.violation_log &&
                Array.isArray(results.violation_log) &&
                results.violation_log.some((e: any) => e.type === "submission_stalled")
              )
                ? "text-red-800 dark:text-red-200"
                : "text-amber-800 dark:text-amber-300"
            } mt-2 mb-4`}
          >
            {(() => {
              if (results.violation_reason) {
                const reason = results.violation_reason.toLowerCase()
                if (reason.includes("tab switch")) {
                  return (
                    <div className="space-y-2">
                      <div className="text-base font-medium text-red-800 dark:text-red-200 leading-relaxed">
                        You switched tabs{" "}
                        <span className="font-bold text-red-600 dark:text-red-400 text-lg">
                          {results.tab_switch_count || 5}
                        </span>{" "}
                        times, exceeding the allowed limit. Your assessment was automatically submitted due to this
                        policy violation.
                      </div>
                      <div className="text-sm text-red-700 dark:text-red-300 font-medium">✓ All answers have been saved</div>
                    </div>
                  )
                }
                if (reason.includes("gemini") || reason.includes("ai tool")) {
                  return (
                    <div className="space-y-2">
                      <div className="text-base font-medium text-red-800 dark:text-red-200 leading-relaxed">
                        Our system detected AI tool usage{" "}
                        <span className="font-bold text-red-600 dark:text-red-400 text-lg">
                          {results.gemini_strikes_count || 5}
                        </span>{" "}
                        times. This assessment requires independent work. Your assessment was automatically submitted due
                        to this policy violation.
                      </div>
                      <div className="text-sm text-red-700 dark:text-red-300 font-medium">✓ All answers have been saved</div>
                    </div>
                  )
                }
                return (
                  <div className="space-y-2">
                    <div className="text-base font-medium text-red-800 dark:text-red-200 leading-relaxed">
                      Your assessment was automatically submitted due to:{" "}
                      <span className="font-bold">{results.violation_reason}</span>
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300 font-medium">
                      ✓ All answers have been saved and recorded
                    </div>
                  </div>
                )
              }

              if (results.violation_log && Array.isArray(results.violation_log)) {
                const stalledEntry = results.violation_log.find((entry: any) => entry.type === "submission_stalled")
                if (stalledEntry) {
                  return (
                    <div className="space-y-2">
                      <div className="text-base font-medium text-amber-800 dark:text-amber-200 leading-relaxed">
                        Submission had network issues. Your answers and score have been saved. This attempt has been
                        flagged for your instructor to manually process or re-evaluate.
                      </div>
                      <div className="text-sm text-amber-700 dark:text-amber-300 font-medium">✓ All answers have been saved</div>
                    </div>
                  )
                }
              }

              let autoSubmitReason: string | null = null
              if (results.violation_log && Array.isArray(results.violation_log)) {
                const autoSubmitEntry = results.violation_log.find(
                  (entry: any) => entry.type === "auto_submit" || entry.type === "auto-submit",
                )
                if (autoSubmitEntry) {
                  autoSubmitReason = autoSubmitEntry.reason || autoSubmitEntry.message || null
                }
              }

              if (autoSubmitReason) {
                const r = autoSubmitReason.toLowerCase()
                if (r.includes("tab switch")) {
                  return (
                    <div className="space-y-2">
                      <div className="text-base font-medium text-red-800 dark:text-red-200 leading-relaxed">
                        You exceeded the allowed tab switch limit (
                        <span className="font-bold text-red-600 dark:text-red-400 text-lg">
                          {results.tab_switch_count || 5}
                        </span>{" "}
                        switches). Your assessment was automatically submitted.
                      </div>
                      <div className="text-sm text-red-700 dark:text-red-300 font-medium">✓ All answers have been saved</div>
                    </div>
                  )
                }
                return (
                  <div className="space-y-2">
                    <div className="text-base font-medium text-red-800 dark:text-red-200 leading-relaxed">
                      Reason: <span className="font-bold">{autoSubmitReason}</span>
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300 font-medium">
                      ✓ All answers have been recorded and saved
                    </div>
                  </div>
                )
              }

              if (results.gemini_strikes_count && results.gemini_strikes_count >= 5) {
                return (
                  <div className="space-y-2">
                    <div className="text-base font-medium text-red-800 dark:text-red-200 leading-relaxed">
                      Our system detected AI tool usage{" "}
                      <span className="font-bold text-red-600 dark:text-red-400 text-lg">{results.gemini_strikes_count}</span>{" "}
                      times. This assessment requires independent work. Your assessment was automatically submitted due to
                      this policy violation.
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300 font-medium">✓ All answers have been saved</div>
                  </div>
                )
              }

              if (
                results.tab_switch_count > 5 ||
                results.copy_paste_attempts > 3 ||
                results.mouse_leave_count > 10
              ) {
                return (
                  <div className="space-y-2">
                    <div className="text-base font-medium text-red-800 dark:text-red-200 leading-relaxed">
                      Your assessment was automatically submitted due to excessive policy violations.
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300 font-medium">✓ All answers have been safely recorded</div>
                  </div>
                )
              }

              return "This submission includes minor behavioral flags logged for review."
            })()}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center gap-3 mt-4 text-sm flex-wrap"
          >
            {results.gemini_strikes_count > 0 && (
              <span
                className={`px-4 py-2 rounded-full font-semibold shadow-md ${
                  results.auto_submitted || results.violation_reason
                    ? "bg-gradient-to-r from-red-200 to-orange-200 dark:from-red-800/50 dark:to-orange-800/50 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-600"
                    : "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300"
                }`}
              >
                🤖 AI Detections: {results.gemini_strikes_count}
              </span>
            )}
            {results.tab_switch_count > 0 && (
              <span
                className={`px-4 py-2 rounded-full font-semibold shadow-md ${
                  results.auto_submitted || results.violation_reason
                    ? "bg-gradient-to-r from-red-200 to-orange-200 dark:from-red-800/50 dark:to-orange-800/50 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-600"
                    : "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300"
                }`}
              >
                🔄 Tab Switches: {results.tab_switch_count}
              </span>
            )}
            {results.copy_paste_attempts > 0 && (
              <span
                className={`px-4 py-2 rounded-full font-semibold shadow-md ${
                  results.auto_submitted || results.violation_reason
                    ? "bg-gradient-to-r from-red-200 to-orange-200 dark:from-red-800/50 dark:to-orange-800/50 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-600"
                    : "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300"
                }`}
              >
                📋 Copy/Paste: {results.copy_paste_attempts}
              </span>
            )}
            {results.mouse_leave_count > 0 && (
              <span
                className={`px-4 py-2 rounded-full font-semibold shadow-md ${
                  results.auto_submitted || results.violation_reason
                    ? "bg-gradient-to-r from-red-200 to-orange-200 dark:from-red-800/50 dark:to-orange-800/50 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-600"
                    : "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300"
                }`}
              >
                🖱️ Mouse Leaves: {results.mouse_leave_count}
              </span>
            )}
          </motion.div>

          {results.auto_submitted && (
            <div className="mt-4 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-red-200 dark:border-red-700">
              <p className="text-sm text-center text-red-700 dark:text-red-300 font-medium">
                All answers and scores have been recorded. Your instructor has been notified of this auto-submission.
              </p>
            </div>
          )}

          <ViolationLogTypeCounts results={results} />
        </div>
      </div>
    </div>
  )
}
