import type { CanvasExportStudent, CanvasExportSubmission } from "@/lib/canvas-gradebook-export"

/**
 * One roster row per Canvas identity: **SIS User ID** when present, else Canvas "ID" (college id), else internal PK.
 * Duplicate `students` rows sharing that key collapse (same person, multiple DB rows).
 * Prefers the row whose internal PK has attempt data, then lowest `internalId` (stable).
 * Submissions are remapped to the chosen canonical internal id; duplicate keys keep the higher score.
 */
export function dedupeCanvasExportRoster(
  students: CanvasExportStudent[],
  submissions: CanvasExportSubmission[],
): { students: CanvasExportStudent[]; submissions: CanvasExportSubmission[] } {
  const submissionInternals = new Set(
    submissions.map((s) => Number(s.student_id)).filter((n) => Number.isFinite(n)),
  )

  const byInternal = new Map<string | number, CanvasExportStudent>()
  for (const st of students) {
    const ik = st.internalId ?? st.id
    if (!byInternal.has(ik)) byInternal.set(ik, st)
  }
  const uniqueByPk = [...byInternal.values()]

  const byVisibleKey = new Map<string, CanvasExportStudent[]>()
  for (const st of uniqueByPk) {
    const vid =
      String(st.sisUserId ?? "").trim() ||
      String(st.id ?? "").trim()
    const key = vid.length > 0 ? vid : `__pk_${String(st.internalId)}`
    const g = byVisibleKey.get(key) ?? []
    g.push(st)
    byVisibleKey.set(key, g)
  }

  const dedupedStudents: CanvasExportStudent[] = []
  const internalRemap = new Map<number, number>()

  for (const [, group] of byVisibleKey) {
    if (group.length === 1) {
      const only = group[0]
      dedupedStudents.push(only)
      internalRemap.set(Number(only.internalId), Number(only.internalId))
      continue
    }

    const sorted = [...group].sort((a, b) => {
      const ah = submissionInternals.has(Number(a.internalId)) ? 1 : 0
      const bh = submissionInternals.has(Number(b.internalId)) ? 1 : 0
      if (bh !== ah) return bh - ah
      return Number(a.internalId) - Number(b.internalId)
    })

    const pick = sorted[0]
    dedupedStudents.push(pick)
    const canon = Number(pick.internalId)
    for (const g of group) {
      internalRemap.set(Number(g.internalId), canon)
    }
  }

  const remapped: CanvasExportSubmission[] = submissions.map((s) => {
    const sid = Number(s.student_id)
    const canon = internalRemap.get(sid)
    return {
      ...s,
      student_id: canon !== undefined ? canon : s.student_id,
    }
  })

  const bestByKey = new Map<string, CanvasExportSubmission>()
  for (const s of remapped) {
    const sid = Number(s.student_id)
    const aid = Number(s.assignment_id)
    if (!Number.isFinite(sid) || !Number.isFinite(aid)) continue
    const k = `${sid}::${aid}`
    const next = { ...s, student_id: sid, assignment_id: aid }
    const prev = bestByKey.get(k)
    if (!prev || Number(next.score) > Number(prev.score)) bestByKey.set(k, next)
  }

  return {
    students: dedupedStudents,
    submissions: [...bestByKey.values()],
  }
}
