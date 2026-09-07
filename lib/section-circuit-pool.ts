/**
 * Section II pooled timer — circuit uploads share one section clock (no per-question timers).
 */

import type { QuestionSection, SectionConfig } from "@/lib/assessment-sections"
import {
  allowsSubmissionReplacement,
  getSectionConfigForQuestionIndex,
  getSectionIndexForQuestion,
  resolveSectionTotalTimeSeconds,
  usesSectionCountdown,
} from "@/lib/assessment-timer"

function normalizeType(type: string): string {
  return (type || "mcq").toLowerCase().trim()
}

export function isCircuitSubmissionType(questionType: string): boolean {
  return normalizeType(questionType) === "circuit_submission"
}

/** Seconds left on a section pool; undefined means not yet initialized (treat as active). */
export function sectionPoolSecondsRemaining(
  sectionIndex: number,
  sectionTimeRemaining: Record<number, number>,
  expiredSections: ReadonlySet<number>,
): number | null {
  if (expiredSections.has(sectionIndex)) return 0
  const raw = sectionTimeRemaining[sectionIndex]
  if (raw === undefined) return null
  return Math.max(0, Math.floor(Number(raw) || 0))
}

export function isSectionPoolActive(
  sectionIndex: number,
  sectionTimeRemaining: Record<number, number>,
  expiredSections: ReadonlySet<number>,
): boolean {
  const remaining = sectionPoolSecondsRemaining(sectionIndex, sectionTimeRemaining, expiredSections)
  return remaining === null || remaining > 0
}

/** While the Section II pool is running, circuit uploads stay editable (no per-question lock). */
export function circuitQuestionEditableWhilePoolActive(
  questionIndex: number,
  questionType: string,
  sections: QuestionSection[],
  parsedConfig: SectionConfig[] | null | undefined,
  sectionTimeRemaining: Record<number, number>,
  expiredSections: ReadonlySet<number>,
): boolean {
  if (!isCircuitSubmissionType(questionType)) return false
  const sectionIndex = getSectionIndexForQuestion(questionIndex, sections)
  if (sectionIndex == null) return false
  const sectionCfg = getSectionConfigForQuestionIndex(questionIndex, sections, parsedConfig ?? null)
  if (!allowsSubmissionReplacement(questionType, sectionCfg)) return false
  return isSectionPoolActive(sectionIndex, sectionTimeRemaining, expiredSections)
}

/** Repair stale persisted 0 on section pool when section has a configured total. */
export function repairStaleSectionPoolSeconds(
  sectionIndex: number,
  persistedSeconds: number,
  sectionConfig: SectionConfig[] | null | undefined,
  questionCountInSection: number,
): number {
  if (persistedSeconds > 0) return Math.floor(persistedSeconds)
  const cfg = sectionConfig?.[sectionIndex]
  if (!cfg || !usesSectionCountdown(cfg)) return persistedSeconds
  const total = resolveSectionTotalTimeSeconds(cfg, {
    questionCountInSection,
    allSections: sectionConfig ?? [],
  })
  return total > 0 ? total : persistedSeconds
}
