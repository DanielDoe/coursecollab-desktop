import { sql } from "@/lib/db"
import { cloneCourseContent } from "@/lib/course-exchange/clone-engine"
import { normalizeModuleList } from "@/lib/course-exchange/modules"
import type { CourseExchangeModule } from "@/lib/course-exchange/types"
import {
  buildExchangeLineage,
  lineageToIdMaps,
  parseExchangeLineage,
} from "@/lib/course-exchange/lineage-snapshot"
import {
  buildSourceManifestBatch,
  hashSourceManifest,
  type SourceManifestEntry,
} from "@/lib/course-exchange/source-manifest"
import type {
  ExchangeEntityType,
  ExchangeLineage,
  ExchangeSyncChange,
  ExchangeSyncDiff,
  ExchangeSyncApplyResult,
} from "@/lib/course-exchange/lineage-types"
import { ensureCourseExchangeSchema } from "@/lib/course-exchange/schema"
import { COURSE_EXCHANGE_MODULE_LABELS } from "@/lib/course-exchange/modules"

type CopyRow = {
  id: number
  request_id: number
  source_course_id: number
  destination_course_id: number
  destination_instructor_id: number
  approved_modules: unknown
  lineage: unknown
  sync_version: number
  source_manifest_hash?: string | null
  cached_sync_diff?: unknown
  source_course_code?: string
  destination_course_code?: string
}

async function loadCopyForInstructor(copyId: number, instructorId: number): Promise<CopyRow | null> {
  await ensureCourseExchangeSchema()
  const rows = (await sql`
    SELECT
      copy.id,
      copy.request_id,
      copy.source_course_id,
      copy.destination_course_id,
      copy.destination_instructor_id,
      copy.approved_modules,
      copy.lineage,
      COALESCE(copy.sync_version, 1) AS sync_version,
      copy.source_manifest_hash,
      copy.cached_sync_diff,
      src.course_code AS source_course_code,
      dst.course_code AS destination_course_code
    FROM course_exchange_copies copy
    JOIN courses src ON src.id = copy.source_course_id
    JOIN courses dst ON dst.id = copy.destination_course_id
    WHERE copy.id = ${copyId}
      AND copy.destination_instructor_id = ${instructorId}
    LIMIT 1
  `) as CopyRow[]
  return rows[0] ?? null
}

function moduleLabel(module: CourseExchangeModule | "syllabus"): string {
  if (module === "syllabus") return "Syllabus"
  return COURSE_EXCHANGE_MODULE_LABELS[module] ?? module
}

function changeSummary(kind: ExchangeSyncChange["kind"], entityType: ExchangeEntityType, label: string): string {
  if (kind === "added") return `New from creator: ${label}`
  if (kind === "removed") return `Removed at source: ${label}`
  if (kind === "modified") {
    if (entityType === "syllabus") return `Creator revised syllabus (replaces your copy if applied)`
    if (entityType === "flashcard_deck") return `Creator updated deck: ${label} (replaces your copy if applied)`
    if (entityType === "course_note") return `Creator updated note: ${label} (replaces your copy if applied)`
    if (entityType === "lecture") return `Creator updated lecture: ${label} (replaces your copy if applied)`
    if (entityType === "quiz") return `Creator updated assessment: ${label} (replaces your copy if applied)`
    if (entityType === "question_bank") return `Creator updated question: ${label} (replaces your copy if applied)`
    return `Creator update: ${label} (replaces your copy if applied)`
  }
  if (entityType === "syllabus") return `Revised syllabus`
  if (entityType === "flashcard_deck") return `Updated flashcard deck: ${label}`
  if (entityType === "course_note") return `Updated note: ${label}`
  if (entityType === "lecture") return `Updated lecture: ${label}`
  if (entityType === "quiz") return `Updated assessment: ${label}`
  if (entityType === "question_bank") return `Updated question: ${label}`
  return `Updated: ${label}`
}

function parseCachedSyncDiff(raw: unknown, copy: CopyRow): ExchangeSyncDiff | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as ExchangeSyncDiff
  if (!Array.isArray(o.changes)) return null
  return {
    ...o,
    copyId: copy.id,
    sourceCourseCode: String(copy.source_course_code ?? o.sourceCourseCode ?? ""),
    destinationCourseCode: String(copy.destination_course_code ?? o.destinationCourseCode ?? ""),
    sourceVersion: copy.sync_version,
    checkedAt: new Date().toISOString(),
  }
}

function buildDiffFromManifest(
  copy: CopyRow,
  lineage: ExchangeLineage,
  sourceNow: Map<string, SourceManifestEntry>,
): ExchangeSyncDiff {
  const lineageByKey = new Map(lineage.items.map((i) => [i.key, i]))
  const changes: ExchangeSyncChange[] = []

  for (const [key, incoming] of sourceNow) {
    const existing = lineageByKey.get(key)
    if (!existing) {
      changes.push({
        changeId: `added:${key}`,
        kind: "added",
        module: incoming.module,
        entityType: incoming.entityType,
        sourceId: incoming.sourceId,
        destinationId: null,
        label: incoming.label,
        summary: changeSummary("added", incoming.entityType, incoming.label),
        yoursLabel: null,
        incomingLabel: incoming.label,
      })
      continue
    }
    if (existing.fingerprint !== incoming.fingerprint) {
      changes.push({
        changeId: `modified:${key}`,
        kind: "modified",
        module: incoming.module,
        entityType: incoming.entityType,
        sourceId: incoming.sourceId,
        destinationId: existing.destinationId,
        label: incoming.label,
        summary: changeSummary("modified", incoming.entityType, incoming.label),
        yoursLabel: existing.label,
        incomingLabel: incoming.label,
      })
    }
  }

  for (const item of lineage.items) {
    if (!sourceNow.has(item.key)) {
      changes.push({
        changeId: `removed:${item.key}`,
        kind: "removed",
        module: item.module,
        entityType: item.entityType,
        sourceId: item.sourceId,
        destinationId: item.destinationId,
        label: item.label,
        summary: changeSummary("removed", item.entityType, item.label),
        yoursLabel: item.label,
        incomingLabel: null,
      })
    }
  }

  changes.sort((a, b) => {
    const mo = moduleLabel(a.module).localeCompare(moduleLabel(b.module))
    if (mo !== 0) return mo
    return a.label.localeCompare(b.label)
  })

  return {
    copyId: copy.id,
    sourceCourseCode: String(copy.source_course_code ?? ""),
    destinationCourseCode: String(copy.destination_course_code ?? ""),
    sourceVersion: copy.sync_version,
    hasUpdates: changes.some((c) => c.kind !== "removed"),
    changeCount: changes.length,
    changes,
    checkedAt: new Date().toISOString(),
  }
}

async function persistSyncCache(copyId: number, manifestHash: string, diff: ExchangeSyncDiff) {
  await sql`
    UPDATE course_exchange_copies
    SET source_manifest_hash = ${manifestHash},
        cached_sync_diff = ${JSON.stringify(diff)}::jsonb,
        cached_sync_diff_at = NOW(),
        pending_update_count = ${diff.hasUpdates ? diff.changeCount : 0}
    WHERE id = ${copyId}
  `
}

export async function computeExchangeSyncDiff(
  copyId: number,
  instructorId: number,
  options?: { force?: boolean },
): Promise<ExchangeSyncDiff | null> {
  const copy = await loadCopyForInstructor(copyId, instructorId)
  if (!copy) return null

  const modules = normalizeModuleList(copy.approved_modules)
  const lineage = parseExchangeLineage(copy.lineage)

  if (!lineage) {
    const empty: ExchangeSyncDiff = {
      copyId,
      sourceCourseCode: String(copy.source_course_code ?? ""),
      destinationCourseCode: String(copy.destination_course_code ?? ""),
      sourceVersion: copy.sync_version,
      hasUpdates: false,
      changeCount: 0,
      changes: [],
      checkedAt: new Date().toISOString(),
    }
    return empty
  }

  const sourceNow = await buildSourceManifestBatch(copy.source_course_id, modules)
  const manifestHash = hashSourceManifest(sourceNow.values())

  if (!options?.force && copy.source_manifest_hash && copy.source_manifest_hash === manifestHash && copy.cached_sync_diff) {
    const cached = parseCachedSyncDiff(copy.cached_sync_diff, copy)
    if (cached) return cached
  }

  const diff = buildDiffFromManifest(copy, lineage, sourceNow)
  await persistSyncCache(copyId, manifestHash, diff)
  return diff
}

async function applySyllabusUpdate(sourceCourseId: number, destCourseId: number, destInstructorId: number) {
  await sql`
    INSERT INTO course_syllabi (
      course_id, title, term, status, sections, created_by, updated_by,
      content_mode, pdf_url, pdf_file_name, logo_url, logo_file_name, published_at
    )
    SELECT
      ${destCourseId}, title, term, 'draft', sections, ${destInstructorId}, ${destInstructorId},
      content_mode, pdf_url, pdf_file_name, logo_url, logo_file_name, NULL
    FROM course_syllabi
    WHERE course_id = ${sourceCourseId}
    ON CONFLICT (course_id) DO UPDATE SET
      title = EXCLUDED.title,
      term = EXCLUDED.term,
      sections = EXCLUDED.sections,
      content_mode = EXCLUDED.content_mode,
      pdf_url = EXCLUDED.pdf_url,
      pdf_file_name = EXCLUDED.pdf_file_name,
      logo_url = EXCLUDED.logo_url,
      logo_file_name = EXCLUDED.logo_file_name,
      updated_at = NOW()
  `
}

async function applyLectureUpdate(sourceId: number, destId: number, destInstructorId: number) {
  // One-way sync: copies creator lecture fields into the destination row only.
  // Faculty edits stay until they explicitly apply this update.
  await sql`
    UPDATE lectures dst SET
      week = src.week,
      title = src.title,
      session = src.session,
      description = src.description,
      materials_url = src.materials_url,
      professor_notes = src.professor_notes,
      lecture_summary = src.lecture_summary,
      learning_objectives = src.learning_objectives,
      original_file_url = src.original_file_url,
      original_file_type = src.original_file_type,
      pdf_url = src.pdf_url,
      thumbnail_url = src.thumbnail_url,
      content_mode = src.content_mode,
      allow_download = src.allow_download,
      sample_practice = src.sample_practice,
      lecture_workspace = src.lecture_workspace,
      updated_at = NOW()
    FROM lectures src
    WHERE src.id = ${sourceId} AND dst.id = ${destId}
  `
  await sql`DELETE FROM lecture_slides WHERE lecture_id = ${destId}`
  await sql`
    INSERT INTO lecture_slides (
      lecture_id, content_type, title, content, file_url, slide_order, is_active,
      created_by, subtitle, background_gradient, ai_summary, ai_keywords
    )
    SELECT
      ${destId}, content_type, title, content, file_url, slide_order, is_active,
      ${destInstructorId}, subtitle, background_gradient, ai_summary, ai_keywords
    FROM lecture_slides
    WHERE lecture_id = ${sourceId} AND deleted_at IS NULL
  `
}

async function applyNoteUpdate(sourceId: number, destId: number, destInstructorId: number) {
  await sql`
    UPDATE course_digital_notes dst SET
      topic = src.topic,
      title = src.title,
      body_text = src.body_text,
      ink_workspace = src.ink_workspace,
      session = src.session,
      updated_at = NOW()
    FROM course_digital_notes src
    WHERE src.id = ${sourceId} AND dst.id = ${destId}
  `
}

async function applyDeckUpdate(sourceId: number, destId: number, destInstructorId: number) {
  await sql`
    UPDATE flashcard_decks dst SET
      title = src.title,
      description = src.description,
      deck_kind = src.deck_kind,
      topic = src.topic,
      show_in_practice_hub = src.show_in_practice_hub,
      card_count = src.card_count,
      require_mcq_validation = src.require_mcq_validation,
      cards_before_quiz = src.cards_before_quiz,
      updated_at = NOW()
    FROM flashcard_decks src
    WHERE src.id = ${sourceId} AND dst.id = ${destId}
  `
  await sql`DELETE FROM flashcard_cards WHERE deck_id = ${destId}`
  await sql`
    INSERT INTO flashcard_cards (deck_id, front_text, back_text, sort_order, custom_distractors, difficulty)
    SELECT ${destId}, front_text, back_text, sort_order, custom_distractors, difficulty
    FROM flashcard_cards
    WHERE deck_id = ${sourceId} AND deleted_at IS NULL
  `
}

async function applyQuestionUpdate(sourceId: number, destId: number) {
  // One-way sync: copies creator question_bank row into destination only (no schema rewrite).
  await sql`
    UPDATE question_bank dst SET
      question_text = src.question_text,
      question_type = src.question_type,
      difficulty = src.difficulty,
      topic = src.topic,
      options = src.options,
      correct_answer = src.correct_answer,
      hint = src.hint,
      evaluation_mode = src.evaluation_mode,
      answer_guidelines = src.answer_guidelines,
      sample_answer = src.sample_answer,
      explanation = src.explanation,
      sample_answers = src.sample_answers,
      ai_expected_solution = src.ai_expected_solution,
      max_points = src.max_points,
      question_media = src.question_media,
      subquestions = src.subquestions,
      updated_at = NOW()
    FROM question_bank src
    WHERE src.id = ${sourceId} AND dst.id = ${destId}
  `
}

export async function applyExchangeSyncUpdates(
  copyId: number,
  instructorId: number,
  changeIds: string[],
): Promise<ExchangeSyncApplyResult> {
  const copy = await loadCopyForInstructor(copyId, instructorId)
  if (!copy) throw new Error("Copy not found.")

  const diff = await computeExchangeSyncDiff(copyId, instructorId)
  if (!diff) throw new Error("Copy not found.")

  const selected = new Set(changeIds)
  const toApply = diff.changes.filter((c) => selected.has(c.changeId))
  if (toApply.length === 0) throw new Error("Select at least one change to apply.")

  const lineage = parseExchangeLineage(copy.lineage)
  if (!lineage) throw new Error("Lineage missing for this copy. Contact support to rebuild lineage.")

  const maps = lineageToIdMaps(lineage)
  const modules = normalizeModuleList(copy.approved_modules)
  let applied = 0
  let skipped = 0
  const summary: Record<string, number> = {}

  for (const change of toApply) {
    if (change.kind === "removed") {
      skipped += 1
      continue
    }

    if (change.kind === "modified") {
      if (change.entityType === "syllabus") {
        await applySyllabusUpdate(copy.source_course_id, copy.destination_course_id, copy.destination_instructor_id)
        summary.syllabus = (summary.syllabus ?? 0) + 1
        applied += 1
      } else if (change.entityType === "lecture" && change.destinationId) {
        await applyLectureUpdate(change.sourceId, change.destinationId, copy.destination_instructor_id)
        summary.lectures = (summary.lectures ?? 0) + 1
        applied += 1
      } else if (change.entityType === "course_note" && change.destinationId) {
        await applyNoteUpdate(change.sourceId, change.destinationId, copy.destination_instructor_id)
        summary.course_notes = (summary.course_notes ?? 0) + 1
        applied += 1
      } else if (change.entityType === "flashcard_deck" && change.destinationId) {
        await applyDeckUpdate(change.sourceId, change.destinationId, copy.destination_instructor_id)
        summary.flashcards = (summary.flashcards ?? 0) + 1
        applied += 1
      } else if (change.entityType === "question_bank" && change.destinationId) {
        await applyQuestionUpdate(change.sourceId, change.destinationId)
        summary.question_bank = (summary.question_bank ?? 0) + 1
        applied += 1
      } else {
        skipped += 1
      }
    }
  }

  const addedChanges = toApply.filter((c) => c.kind === "added")
  if (addedChanges.length > 0) {
    const addedModuleSet = new Set<CourseExchangeModule>()
    for (const change of addedChanges) {
      if (change.module !== "syllabus") addedModuleSet.add(change.module as CourseExchangeModule)
    }
    if (addedChanges.some((c) => c.module === "syllabus" || c.entityType === "syllabus")) {
      await applySyllabusUpdate(copy.source_course_id, copy.destination_course_id, copy.destination_instructor_id)
      summary.syllabus = (summary.syllabus ?? 0) + 1
      applied += 1
    }
    if (addedModuleSet.size > 0) {
      const cloneResult = await cloneCourseContent({
        sourceCourseId: copy.source_course_id,
        destinationCourseId: copy.destination_course_id,
        destinationInstructorId: copy.destination_instructor_id,
        selectedModules: [...addedModuleSet],
        maps,
        reuseMaps: maps,
      })
      for (const [k, v] of Object.entries(cloneResult.summary)) {
        if (v > 0) summary[k] = (summary[k] ?? 0) + v
      }
      applied += addedChanges.filter((c) => c.kind === "added" && c.entityType !== "syllabus").length
    }
  }

  const nextLineage = await buildExchangeLineage({
    sourceCourseId: copy.source_course_id,
    destinationCourseId: copy.destination_course_id,
    maps,
    modules,
    version: copy.sync_version + 1,
  })

  await sql`
    UPDATE course_exchange_copies
    SET lineage = ${JSON.stringify(nextLineage)}::jsonb,
        sync_version = ${copy.sync_version + 1},
        last_synced_at = NOW(),
        pending_update_count = 0,
        sync_in_progress = false
    WHERE id = ${copyId}
  `

  const sourceNow = await buildSourceManifestBatch(copy.source_course_id, modules)
  const manifestHash = hashSourceManifest(sourceNow.values())
  const emptyDiff = buildDiffFromManifest(
    { ...copy, sync_version: copy.sync_version + 1 },
    nextLineage,
    sourceNow,
  )
  await persistSyncCache(copyId, manifestHash, emptyDiff)

  return { applied, skipped, lineage: nextLineage, summary }
}

/** Hash-first refresh for list badges — full diff only when source manifest changed. */
export async function refreshExchangeUpdateCounts(instructorId: number) {
  await ensureCourseExchangeSchema()
  const rows = (await sql`
    SELECT
      id,
      source_course_id,
      approved_modules,
      source_manifest_hash,
      COALESCE(pending_update_count, 0) AS pending_update_count
    FROM course_exchange_copies
    WHERE destination_instructor_id = ${instructorId}
  `) as {
    id: number
    source_course_id: number
    approved_modules: unknown
    source_manifest_hash: string | null
    pending_update_count: number
  }[]

  const out: Record<number, { changeCount: number; hasUpdates: boolean }> = {}
  for (const row of rows) {
    const modules = normalizeModuleList(row.approved_modules)
    const sourceNow = await buildSourceManifestBatch(row.source_course_id, modules)
    const hash = hashSourceManifest(sourceNow.values())
    if (row.source_manifest_hash && row.source_manifest_hash === hash) {
      out[row.id] = {
        changeCount: row.pending_update_count,
        hasUpdates: row.pending_update_count > 0,
      }
      continue
    }
    const diff = await computeExchangeSyncDiff(row.id, instructorId, { force: true })
    out[row.id] = {
      changeCount: diff?.changeCount ?? 0,
      hasUpdates: diff?.hasUpdates ?? false,
    }
  }
  return out
}

export async function listExchangeUpdateSummaries(instructorId: number) {
  return refreshExchangeUpdateCounts(instructorId)
}
