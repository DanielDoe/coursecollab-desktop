import type { SyllabusTemplateProvenance } from "@/lib/syllabus-exchange/types"

export const SYLLABUS_EXCHANGE_INDEPENDENT_COPY_NOTE =
  "This is an independent copy. Your edits never change the original syllabus, and updates to the source are not synced automatically."

export function parseSyllabusTemplateProvenance(raw: unknown): SyllabusTemplateProvenance | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const sourceSyllabusId = Number(o.sourceSyllabusId)
  const copyRecordId = Number(o.copyRecordId)
  if (!Number.isFinite(sourceSyllabusId) || !Number.isFinite(copyRecordId)) return null
  if (typeof o.sourceInstructorName !== "string" || typeof o.sourceCourseCode !== "string") return null
  return {
    sourceSyllabusId,
    sourceCourseId: Number(o.sourceCourseId) || 0,
    sourceCourseCode: o.sourceCourseCode,
    sourceCourseTitle: typeof o.sourceCourseTitle === "string" ? o.sourceCourseTitle : "",
    sourceInstructorId: Number(o.sourceInstructorId) || 0,
    sourceInstructorName: o.sourceInstructorName,
    sourceTerm: typeof o.sourceTerm === "string" ? o.sourceTerm : "",
    sourceSessionCode:
      typeof o.sourceSessionCode === "string" ? o.sourceSessionCode : null,
    copiedAt: typeof o.copiedAt === "string" ? o.copiedAt : "",
    copyRecordId,
  }
}

export function formatSyllabusProvenanceLine(provenance: SyllabusTemplateProvenance): string {
  const session = provenance.sourceSessionCode ? ` · ${provenance.sourceSessionCode}` : ""
  const term = provenance.sourceTerm ? ` · ${provenance.sourceTerm}` : ""
  return `${provenance.sourceInstructorName} · ${provenance.sourceCourseCode}${session}${term}`
}
