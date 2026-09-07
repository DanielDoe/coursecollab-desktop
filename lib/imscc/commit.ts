import { createInstructorCourse } from "@/lib/create-instructor-course"
import { ensureCourseDigitalNotesSchema } from "@/lib/course-digital-notes"
import { ensureSyllabusSchema } from "@/lib/ensure-syllabus-schema"
import { htmlToNoteBody } from "@/lib/imscc/html"
import { buildImsccReview, emptyImsccCounts } from "@/lib/imscc/review"
import type { ImsccCatalog, ImsccCommitCounts, ImsccItem, ImsccReview } from "@/lib/imscc/types"
import { persistNormalizedQuestionBankRow } from "@/lib/question-bank-persist-normalize"
import { normalizeQuestionBankRowForStorage } from "@/lib/question-type-schema"
import { sanitizeStoredContent } from "@/lib/security/sanitize-html"
import { defaultElegSectionForCatalogCourse } from "@/lib/course-section-model"
import { sql } from "@/lib/db"
import { invalidateSessionCatalogCache } from "@/lib/session-catalog"
import { getActiveInstitutionLicense } from "@/lib/institutions/licenses"
import type { SyllabusSection } from "@/lib/syllabus/types"

export type ImsccCommitInput = {
  instructorId: number
  catalog: ImsccCatalog
  selectedIds: string[]
  courseCode: string
  courseTitle: string
  description?: string | null
  university?: string | null
  universityId?: number | null
  attachToActiveLicense?: boolean
}

export type ImsccCommitResult = {
  course: {
    id: number
    course_code: string
    course_title: string
    university: string | null
    semester: string | null
    academic_term_id: number | null
    module_settings: unknown
  }
  counts: ImsccCommitCounts
  review: ImsccReview
}

function selectedItems(catalog: ImsccCatalog, selectedIds: string[]): ImsccItem[] {
  const allow = new Set(selectedIds)
  return catalog.items.filter((item) => allow.has(item.identifier) && !item.mapping.blocked)
}

function assessmentTypeFor(item: ImsccItem): "homework" | "quiz" | "mid_semester" | "final" {
  if (item.mapping.target === "quizzes") return "quiz"
  if (item.mapping.target === "mid_semester") return "mid_semester"
  if (item.mapping.target === "final") return "final"
  return "homework"
}

async function addCourseToLicenseScope(universityId: number, courseId: number): Promise<void> {
  const license = await getActiveInstitutionLicense(universityId)
  if (!license) return
  const licenseId = Number(license.id)
  const existing = await sql`
    SELECT 1 FROM institution_license_scopes
    WHERE license_id = ${licenseId} AND course_id = ${courseId}
    LIMIT 1
  `
  if (existing.length > 0) return
  await sql`
    INSERT INTO institution_license_scopes (license_id, scope_type, course_id, scope_id)
    VALUES (${licenseId}, 'course', ${courseId}, ${courseId})
  `
}

export async function commitImsccImport(input: ImsccCommitInput): Promise<ImsccCommitResult> {
  const items = selectedItems(input.catalog, input.selectedIds)
  const course = await createInstructorCourse({
    instructorId: input.instructorId,
    courseCode: input.courseCode,
    courseTitle: input.courseTitle,
    description: input.description ?? `Imported from Canvas (${input.catalog.info.schema} ${input.catalog.info.schemaVersion})`,
    university: input.university,
  })

  let universityId = input.universityId ?? null
  if (universityId == null) {
    const instRows = (await sql`
      SELECT university_id FROM instructors WHERE id = ${input.instructorId} LIMIT 1
    `) as { university_id: number | null }[]
    const fromInstructor = instRows[0]?.university_id
    if (fromInstructor != null && Number.isFinite(Number(fromInstructor))) {
      universityId = Number(fromInstructor)
    }
  }
  if (universityId != null && Number.isFinite(universityId)) {
    await sql`UPDATE courses SET university_id = ${universityId} WHERE id = ${course.id}`
    if (input.attachToActiveLicense) {
      await addCourseToLicenseScope(universityId, course.id)
    }
  }

  if (course.academic_term_id) {
    const fromTitle = String(input.courseTitle || "").toUpperCase().match(/ELEG\d{4}P\d{2}/)?.[0]
    const sectionCode = fromTitle || defaultElegSectionForCatalogCourse(course.course_code)
    if (sectionCode) {
      const existing = await sql`
        SELECT id FROM sessions
        WHERE course_id = ${course.id} AND academic_term_id = ${course.academic_term_id}
          AND TRIM(UPPER(code)) = ${sectionCode}
        LIMIT 1
      `
      if (existing.length === 0) {
        await sql`
          INSERT INTO sessions (code, description, academic_term_id, course_id)
          VALUES (${sectionCode}, ${course.course_code}, ${course.academic_term_id}, ${course.id})
        `
        invalidateSessionCatalogCache()
      }
    }
  }

  const counts = emptyImsccCounts()
  counts.skipped = input.catalog.items.length - items.length

  await ensureSyllabusSchema()
  await ensureCourseDigitalNotesSchema()

  const syllabus = items.find((i) => i.kind === "syllabus")
  if (syllabus) {
    const body = htmlToNoteBody(syllabus.html ?? "")
    const sections: SyllabusSection[] = [
      {
        sectionId: "imported-canvas-syllabus",
        title: "Imported syllabus",
        order: 1,
        type: "text",
        content: { markdown: body || "Imported from Canvas. Replace with a structured CourseCollab syllabus." },
        isRequired: false,
        isVisible: true,
        isEditable: true,
      },
    ]
    await sql`
      INSERT INTO course_syllabi (
        course_id, title, term, status, sections, created_by, updated_by, content_mode, published_at
      ) VALUES (
        ${course.id},
        ${`${course.course_title} syllabus`},
        ${input.catalog.info.termLabel ?? course.semester ?? ""},
        ${"draft"},
        ${JSON.stringify(sections)}::jsonb,
        ${input.instructorId},
        ${input.instructorId},
        ${"structured"},
        NULL
      )
    `
    counts.syllabus = 1
  }

  for (const item of items) {
    if (item.kind === "page" || item.kind === "announcement" || item.kind === "discussion" || item.kind === "weblink") {
      const topic =
        item.kind === "announcement"
          ? "Imported announcements"
          : item.kind === "discussion"
            ? "Imported discussions"
            : item.moduleTitle ?? "Imported pages"
      const body =
        item.kind === "weblink"
          ? `${htmlToNoteBody(item.html ?? "")}\n\n${item.url ?? ""}`.trim()
          : htmlToNoteBody(item.html ?? "")
      await sql`
        INSERT INTO course_digital_notes (
          course_id, instructor_id, topic, title, body_text, session, is_published
        ) VALUES (
          ${course.id},
          ${input.instructorId},
          ${topic},
          ${item.title},
          ${sanitizeStoredContent(body || item.title)},
          NULL,
          false
        )
      `
      counts.notes += 1
      if (item.kind === "weblink") counts.links += 1
    }
  }

  const lectureItems = items.filter((i) => i.kind === "lecture")
  const lectureByModule = new Map<string, typeof lectureItems>()
  for (const item of lectureItems) {
    const key = item.moduleId ?? `loose-${item.identifier}`
    const list = lectureByModule.get(key) ?? []
    list.push(item)
    lectureByModule.set(key, list)
  }
  for (const group of lectureByModule.values()) {
    for (const item of group) {
      const week = item.week ?? 1
      await sql`
        INSERT INTO lectures (
          title, week, description, course_id, is_published, content_mode, allow_download, created_at, updated_at
        ) VALUES (
          ${item.title.replace(/\.(pptx?|pdf)$/i, "")},
          ${week},
          ${item.moduleTitle ? `Imported from Canvas module: ${item.moduleTitle}` : "Imported from Canvas"},
          ${course.id},
          false,
          ${"pdf"},
          false,
          NOW(),
          NOW()
        )
      `
      counts.lectures += 1
    }
  }

  for (const item of items) {
    if (item.kind !== "assignment" && item.kind !== "quiz") continue
    if (item.mapping.target === "question_bank") continue
    if (item.mapping.target === "attendance" || item.mapping.target === "classroom_points" || item.mapping.target === "none") {
      continue
    }
    const type = assessmentTypeFor(item)
    const description = [item.assignmentGroupTitle, item.submissionTypes, htmlToNoteBody(item.html ?? "")]
      .filter(Boolean)
      .join(" · ")
    await sql`
      INSERT INTO quizzes (
        title, description, created_by, is_public, time_per_question, assessment_type, course_id, created_at, updated_at
      ) VALUES (
        ${item.title},
        ${description || "Imported from Canvas as a draft. Add questions before publishing."},
        ${input.instructorId},
        false,
        60,
        ${type},
        ${course.id},
        NOW(),
        NOW()
      )
    `
    counts.assessments += 1
    if (type === "quiz") counts.quizzes += 1
    else if (type === "homework") counts.homework += 1
  }

  for (const item of items) {
    if (!item.questions?.length) continue
    for (const q of item.questions) {
      const storedType = q.mappedType === "needs_review" ? "essay" : q.mappedType
      const normalized = normalizeQuestionBankRowForStorage({
        question_type: storedType,
        options: q.options,
        correct_answer: q.correctAnswer,
      })
      const inserted = (await sql`
        INSERT INTO question_bank (
          question_text, question_type, difficulty, topic, options, correct_answer,
          course_id, max_points
        ) VALUES (
          ${sanitizeStoredContent(q.stem)},
          ${storedType},
          ${"medium"},
          ${item.title},
          ${JSON.stringify(normalized.options)}::jsonb,
          ${JSON.stringify(normalized.correct_answer)}::jsonb,
          ${course.id},
          ${q.points ?? 1}
        )
        RETURNING id
      `) as { id: number }[]
      const id = inserted[0]?.id
      if (id) await persistNormalizedQuestionBankRow(id, course.id)
      counts.questions += 1
      if (q.needsReview) counts.questionsNeedingReview += 1
    }
  }

  counts.files = items.filter((i) => i.kind === "file").length
  counts.filesCataloged = counts.files + counts.lectures
  counts.total =
    counts.syllabus +
    counts.notes +
    counts.lectures +
    counts.assessments +
    counts.questions +
    counts.files +
    counts.links

  return {
    course: {
      id: course.id,
      course_code: course.course_code,
      course_title: course.course_title,
      university: course.university,
      semester: course.semester,
      academic_term_id: course.academic_term_id,
      module_settings: course.module_settings,
    },
    counts,
    review: buildImsccReview(items, counts),
  }
}
