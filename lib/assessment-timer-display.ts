import { parseAssessmentSectionConfig, type SectionConfig } from "@/lib/assessment-sections"
import { getExamSharedTimerSeconds, isUntimedAssessmentType } from "@/lib/assessment-timer"
import { isSingleSittingExamAssessmentDbType } from "@/lib/final-exam-policy"

export function resolveAssessmentTimerDisplayLabel(
  assessmentType: string | null | undefined,
  sectionConfig: SectionConfig[] | string | null | undefined,
  timePerQuestionSeconds: number | null | undefined,
): string {
  if (isUntimedAssessmentType(assessmentType)) {
    return "Untimed"
  }

  const parsed = parseAssessmentSectionConfig(sectionConfig)
  const examShared = getExamSharedTimerSeconds(parsed)
  if (examShared != null) {
    const mins = Math.round(examShared / 60)
    return `${mins} min total (shared timer)`
  }

  if (isSingleSittingExamAssessmentDbType(assessmentType)) {
    for (const section of parsed ?? []) {
      const secs = Number(section.total_time_seconds)
      if (Number.isFinite(secs) && secs > 0) {
        return `${Math.round(secs / 60)} min total`
      }
    }
  }

  const tpq = Math.round(Number(timePerQuestionSeconds) || 60)
  return `${tpq}s each`
}
