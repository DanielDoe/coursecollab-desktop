import { sql } from "@/lib/db"
import { resolveExchangeDestinationCourseId } from "@/lib/faculty-destination-course-shell"
import { cloneCourseContent, clearDestinationExchangeContent, POST_COPY_CHECKLIST } from "@/lib/course-exchange/clone-engine"
import { resolveExchangeDestinationSessionCode } from "@/lib/course-exchange/destination-session-resolve"
import { filterGroupsProjectsForOwnSession } from "@/lib/course-exchange/groups-projects-session-policy"
import { buildExchangeLineage, lineageToIdMaps, parseExchangeLineage } from "@/lib/course-exchange/lineage-snapshot"
import { buildSourceManifestBatch, hashSourceManifest } from "@/lib/course-exchange/source-manifest"
import {
  defaultApprovalModules,
  defaultRequestedModules,
  normalizeModuleList,
  COURSE_EXCHANGE_SENSITIVE_MODULES,
  COURSE_EXCHANGE_MODULE_LABELS,
} from "@/lib/course-exchange/modules"
import {
  exchangeMissingShareableModules,
  exchangePendingSupplementModules,
  requestNeedsCreatorReview,
} from "@/lib/course-exchange/provenance-shared"
import {
  notifyCourseExchangeApproved,
  notifyCourseExchangeCopyCompleted,
  notifyCourseExchangeCopyFailed,
  notifyCourseExchangeRejected,
  notifyCourseExchangeRequestReceived,
  notifyCourseExchangeSupplementRequested,
} from "@/lib/course-exchange/notifications"
import { ensureCourseExchangeSchema } from "@/lib/course-exchange/schema"
import {
  assertActiveFaculty,
  assertCourseOwner,
  assertCreatorCanReview,
  assertDestinationOwnedByRequester,
  assertRequesterCanImport,
  loadExchangeRequest,
  resolveApprovedModules,
} from "@/lib/course-exchange/security"
import type {
  CourseExchangeAttribution,
  CourseExchangeModule,
  CourseExchangeRequestRow,
  CourseExchangeRequestStatus,
  CourseExchangeSharingMode,
  DiscoverableCourse,
  DiscoverCourseRelationship,
  DiscoverCourseRelationshipKind,
  ExchangeTimelineEntry,
} from "@/lib/course-exchange/types"

export type CourseSharingSettingsView = {
  courseId: number
  courseCode: string
  courseTitle: string
  sharingMode: CourseExchangeSharingMode
  /** Display name in Discover; falls back to course title when null/empty. */
  discoverableTitle: string | null
  shareableModules: CourseExchangeModule[]
  autoApprove: boolean
}

export type CourseExchangeAccessLogRow = {
  id: number
  courseId: number
  courseCode: string
  courseTitle: string
  requesterName: string
  eventType: string
  modules: CourseExchangeModule[]
  autoApproved: boolean
  note: string | null
  createdAt: string
}

function resolveDiscoverableTitle(
  stored: string | null | undefined,
  courseTitle: string,
  courseCode: string,
): string {
  const t = stored?.trim()
  if (t) return t
  return courseTitle?.trim() || courseCode
}

function mapSharingRow(row: {
  course_id?: number | null
  courseId?: number
  sharing_mode: CourseExchangeSharingMode | null
  discoverable_title: string | null
  shareable_modules?: unknown
  auto_approve?: boolean | string | number | null
  course_code: string
  course_title: string
}): CourseSharingSettingsView {
  const courseId = Number(row.courseId ?? row.course_id)
  const shareable = normalizeModuleList(row.shareable_modules)
  return {
    courseId,
    courseCode: row.course_code,
    courseTitle: row.course_title,
    sharingMode: (row.sharing_mode ?? "off") as CourseExchangeSharingMode,
    discoverableTitle: resolveDiscoverableTitle(row.discoverable_title, row.course_title, row.course_code),
    shareableModules: shareable.length > 0 ? shareable : defaultApprovalModules(),
    autoApprove: Boolean(row.auto_approve === true || row.auto_approve === "t" || row.auto_approve === 1),
  }
}

async function writeAccessLog(input: {
  courseId: number
  sourceInstructorId: number
  requesterInstructorId: number
  requestId?: number | null
  eventType: string
  modules: CourseExchangeModule[]
  autoApproved?: boolean
  note?: string | null
}) {
  await sql`
    INSERT INTO course_exchange_access_log (
      course_id, source_instructor_id, requester_instructor_id, request_id,
      event_type, modules, auto_approved, note
    )
    VALUES (
      ${input.courseId},
      ${input.sourceInstructorId},
      ${input.requesterInstructorId},
      ${input.requestId ?? null},
      ${input.eventType},
      ${JSON.stringify(input.modules)}::jsonb,
      ${Boolean(input.autoApproved)},
      ${input.note ?? null}
    )
  `
}

function relationshipKindFromStatus(status: CourseExchangeRequestStatus): DiscoverCourseRelationshipKind {
  switch (status) {
    case "PENDING":
      return "pending"
    case "APPROVED":
      return "approved"
    case "COPYING":
      return "copying"
    case "COMPLETED":
      return "imported"
    case "FAILED":
      return "failed"
    case "REJECTED":
      return "rejected"
    case "CANCELLED":
      return "cancelled"
    default:
      return "none"
  }
}

async function loadRequesterCourseRelationships(
  requesterInstructorId: number,
  courseIds: number[],
): Promise<Map<number, DiscoverCourseRelationship>> {
  const map = new Map<number, DiscoverCourseRelationship>()
  if (courseIds.length === 0) return map

  const rows = (await sql`
    SELECT DISTINCT ON (r.source_course_id)
      r.source_course_id,
      r.id AS request_id,
      r.status,
      r.approved_modules,
      r.requested_modules,
      copy.id AS copy_id,
      copy.approved_modules AS copy_approved_modules
    FROM course_exchange_requests r
    LEFT JOIN course_exchange_copies copy ON copy.request_id = r.id
    WHERE r.requester_instructor_id = ${requesterInstructorId}
      AND r.source_course_id = ANY(${courseIds}::int[])
    ORDER BY r.source_course_id, r.created_at DESC
  `) as Array<Record<string, unknown>>

  for (const raw of rows) {
    const courseId = Number(raw.source_course_id)
    const status = String(raw.status).toUpperCase() as CourseExchangeRequestStatus
    const approvedModules = normalizeModuleList(
      raw.copy_approved_modules ?? raw.approved_modules ?? raw.requested_modules,
    )
    map.set(courseId, {
      kind: relationshipKindFromStatus(status),
      requestId: Number(raw.request_id),
      copyId: raw.copy_id != null ? Number(raw.copy_id) : null,
      status,
      approvedModules,
      missingModules: [],
    })
  }
  return map
}

function timelineLabel(eventType: string): string {
  switch (eventType) {
    case "requested":
      return "Request submitted"
    case "auto_approved":
      return "Auto-approved"
    case "approved":
      return "Approved by course owner"
    case "rejected":
      return "Request declined"
    case "copied":
      return "Materials imported"
    case "supplement_requested":
      return "Additional modules requested"
    case "supplemented":
      return "Additional modules imported"
    default:
      return eventType.replace(/_/g, " ")
  }
}

async function loadCopyByRequestId(requestId: number) {
  const rows = (await sql`
    SELECT *
    FROM course_exchange_copies
    WHERE request_id = ${requestId}
    LIMIT 1
  `) as Array<Record<string, unknown>>
  return rows[0] ?? null
}

export async function getCourseSharingSettings(courseId: number): Promise<CourseSharingSettingsView | null> {
  await ensureCourseExchangeSchema()
  const rows = (await sql`
    SELECT ces.*, c.course_code, c.course_title
    FROM courses c
    LEFT JOIN course_exchange_settings ces ON ces.course_id = c.id
    WHERE c.id = ${courseId}
    LIMIT 1
  `) as {
    course_id: number | null
    sharing_mode: CourseExchangeSharingMode | null
    discoverable_title: string | null
    shareable_modules: unknown
    course_code: string
    course_title: string
  }[]
  const row = rows[0]
  if (!row) return null
  return mapSharingRow(row)
}

/** All active courses owned by this instructor, with exchange opt-in status. */
export async function listInstructorCoursesWithSharingSettings(
  instructorId: number,
): Promise<CourseSharingSettingsView[]> {
  await ensureCourseExchangeSchema()
  const faculty = await assertActiveFaculty(instructorId)
  if (!faculty.ok) throw new Error(faculty.reason)

  const rows = (await sql`
    SELECT
      c.id AS course_id,
      c.course_code,
      c.course_title,
      ces.sharing_mode,
      ces.discoverable_title,
      ces.shareable_modules,
      ces.auto_approve
    FROM courses c
    LEFT JOIN course_exchange_settings ces ON ces.course_id = c.id
    WHERE c.instructor_id = ${instructorId}
      AND c.is_active = true
    ORDER BY c.course_code ASC, c.course_title ASC
  `) as {
    course_id: number
    course_code: string
    course_title: string
    sharing_mode: CourseExchangeSharingMode | null
    discoverable_title: string | null
    shareable_modules: unknown
    auto_approve: boolean | null
  }[]

  return rows.map((row) => mapSharingRow(row))
}

export async function updateCourseSharingSettings(input: {
  instructorId: number
  courseId: number
  sharingMode: CourseExchangeSharingMode
  discoverableTitle?: string | null
  shareableModules?: CourseExchangeModule[]
  autoApprove?: boolean
}) {
  await ensureCourseExchangeSchema()
  const owner = await assertCourseOwner(input.instructorId, input.courseId)
  if (!owner.ok) throw new Error(owner.reason)

  const courseMeta = (await sql`
    SELECT course_code, course_title FROM courses WHERE id = ${input.courseId} LIMIT 1
  `) as { course_code: string; course_title: string }[]
  const meta = courseMeta[0]
  if (!meta) throw new Error("Course not found.")

  const shareableModules = normalizeModuleList(input.shareableModules ?? defaultApprovalModules())
  if (input.sharingMode === "request_only" && shareableModules.length === 0) {
    throw new Error("Select at least one module to share. Student results are never shared.")
  }

  const title =
    input.discoverableTitle?.trim() ||
    resolveDiscoverableTitle(null, meta.course_title, meta.course_code)

  const autoApprove = Boolean(input.autoApprove)

  await sql`
    INSERT INTO course_exchange_settings (
      course_id, sharing_mode, discoverable_title, discoverable_description, shareable_modules, auto_approve, updated_by, updated_at
    )
    VALUES (
      ${input.courseId},
      ${input.sharingMode},
      ${title},
      NULL,
      ${JSON.stringify(shareableModules)}::jsonb,
      ${autoApprove},
      ${input.instructorId},
      NOW()
    )
    ON CONFLICT (course_id) DO UPDATE SET
      sharing_mode = EXCLUDED.sharing_mode,
      discoverable_title = EXCLUDED.discoverable_title,
      discoverable_description = NULL,
      shareable_modules = EXCLUDED.shareable_modules,
      auto_approve = EXCLUDED.auto_approve,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
  `
  return getCourseSharingSettings(input.courseId)
}

export async function listDiscoverableCourses(input: {
  requesterInstructorId: number
  query?: string | null
  limit?: number
}): Promise<DiscoverableCourse[]> {
  await ensureCourseExchangeSchema()
  const faculty = await assertActiveFaculty(input.requesterInstructorId)
  if (!faculty.ok) throw new Error(faculty.reason)

  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100)
  const q = input.query?.trim()

  const rows = q
    ? ((await sql`
        SELECT
          c.id AS course_id,
          c.course_code,
          c.course_title,
          c.description,
          c.semester,
          c.university,
          ces.discoverable_title,
          ces.shareable_modules,
          ces.auto_approve,
          i.name AS instructor_name,
          COALESCE(i.institution, u.name) AS instructor_institution,
          i.job_title AS instructor_department,
          (c.instructor_id = ${input.requesterInstructorId}) AS is_owner
        FROM course_exchange_settings ces
        JOIN courses c ON c.id = ces.course_id
        JOIN instructors i ON i.id = c.instructor_id
        LEFT JOIN universities u ON u.id = i.university_id
        WHERE ces.sharing_mode = 'request_only'
          AND c.is_active = true
          AND (
            c.course_code ILIKE ${"%" + q + "%"}
            OR c.course_title ILIKE ${"%" + q + "%"}
            OR COALESCE(ces.discoverable_title, '') ILIKE ${"%" + q + "%"}
            OR i.name ILIKE ${"%" + q + "%"}
          )
        ORDER BY (c.instructor_id = ${input.requesterInstructorId}) DESC, c.course_code ASC
        LIMIT ${limit}
      `) as Array<Record<string, unknown>>)
    : ((await sql`
        SELECT
          c.id AS course_id,
          c.course_code,
          c.course_title,
          c.description,
          c.semester,
          c.university,
          ces.discoverable_title,
          ces.shareable_modules,
          ces.auto_approve,
          i.name AS instructor_name,
          COALESCE(i.institution, u.name) AS instructor_institution,
          i.job_title AS instructor_department,
          (c.instructor_id = ${input.requesterInstructorId}) AS is_owner
        FROM course_exchange_settings ces
        JOIN courses c ON c.id = ces.course_id
        JOIN instructors i ON i.id = c.instructor_id
        LEFT JOIN universities u ON u.id = i.university_id
        WHERE ces.sharing_mode = 'request_only'
          AND c.is_active = true
        ORDER BY (c.instructor_id = ${input.requesterInstructorId}) DESC, c.course_code ASC
        LIMIT ${limit}
      `) as Array<Record<string, unknown>>)

  const courseIds = rows.map((r) => Number(r.course_id))
  const relationships = await loadRequesterCourseRelationships(input.requesterInstructorId, courseIds)

  const deduped: Array<Record<string, unknown>> = []
  const seenCatalog = new Set<string>()
  for (const raw of rows) {
    const instructorName = String(raw.instructor_name ?? "").trim().toUpperCase()
    const university = String(raw.university ?? "").trim().toUpperCase()
    const courseCode = String(raw.course_code ?? "").trim().toUpperCase()
    const key = `${instructorName}::${university}::${courseCode}`
    if (seenCatalog.has(key)) continue
    seenCatalog.add(key)
    deduped.push(raw)
  }

  return deduped.map((raw) => {
    const courseCode = String(raw.course_code)
    const courseTitle = String(raw.course_title)
    const shareable = normalizeModuleList(raw.shareable_modules)
    const shareableModules = shareable.length > 0 ? shareable : defaultApprovalModules()
    const courseId = Number(raw.course_id)
    const relationship = relationships.get(courseId)
    if (relationship) {
      const imported = relationship.approvedModules
      relationship.missingModules = exchangeMissingShareableModules(shareableModules, imported)
    }
    return {
      courseId,
      courseCode,
      courseTitle,
      discoverableTitle: resolveDiscoverableTitle(
        raw.discoverable_title != null ? String(raw.discoverable_title) : null,
        courseTitle,
        courseCode,
      ),
      discoverableDescription: null,
      description: raw.description != null ? String(raw.description) : null,
      semester: raw.semester != null ? String(raw.semester) : null,
      university: raw.university != null ? String(raw.university) : null,
      instructorName: String(raw.instructor_name),
      instructorInstitution:
        raw.instructor_institution != null ? String(raw.instructor_institution) : null,
      instructorDepartment:
        raw.instructor_department != null ? String(raw.instructor_department) : null,
      isOwner: Boolean(raw.is_owner === true || raw.is_owner === "t" || raw.is_owner === 1),
      shareableModules,
      autoApprove: Boolean(raw.auto_approve === true || raw.auto_approve === "t" || raw.auto_approve === 1),
      relationship: relationship ?? null,
    }
  })
}

function formatRequestRow(row: CourseExchangeRequestRow) {
  return {
    ...row,
    requested_modules: normalizeModuleList(row.requested_modules),
    approved_modules: row.approved_modules ? normalizeModuleList(row.approved_modules) : null,
  }
}

async function modulesAllowedForDestination(
  modules: CourseExchangeModule[],
  destinationCourseId: number | null | undefined,
  destinationSessionId?: number | null,
): Promise<CourseExchangeModule[]> {
  if (!destinationCourseId) return modules
  const sessionCode = await resolveExchangeDestinationSessionCode(
    destinationCourseId,
    destinationSessionId ?? null,
  )
  return filterGroupsProjectsForOwnSession(modules, sessionCode).modules
}

export async function createCourseExchangeRequest(input: {
  requesterInstructorId: number
  sourceCourseId: number
  purpose?: string | null
  requestedModules?: CourseExchangeModule[]
  requesterInstitution?: string | null
  requesterDepartment?: string | null
  destinationCourseId?: number | null
  destinationSessionId?: number | null
}) {
  await ensureCourseExchangeSchema()
  const faculty = await assertActiveFaculty(input.requesterInstructorId)
  if (!faculty.ok) throw new Error(faculty.reason)

  const sourceRows = (await sql`
    SELECT c.id, c.instructor_id, c.course_code, ces.sharing_mode, ces.shareable_modules, ces.auto_approve, i.name
    FROM courses c
    JOIN course_exchange_settings ces ON ces.course_id = c.id
    JOIN instructors i ON i.id = c.instructor_id
    WHERE c.id = ${input.sourceCourseId}
      AND c.is_active = true
    LIMIT 1
  `) as {
    id: number
    instructor_id: number
    course_code: string
    sharing_mode: string
    shareable_modules: unknown
    auto_approve: boolean | string | number | null
    name: string
  }[]

  const source = sourceRows[0]
  if (!source) throw new Error("Source course not found.")
  if (source.sharing_mode !== "request_only") {
    throw new Error("This course is not available for exchange requests.")
  }
  if (Number(source.instructor_id) === input.requesterInstructorId) {
    throw new Error("You cannot request materials from your own course.")
  }

  const requesterRows = (await sql`
    SELECT name, institution, job_title FROM instructors WHERE id = ${input.requesterInstructorId} LIMIT 1
  `) as { name: string; institution: string | null; job_title: string | null }[]
  const requester = requesterRows[0]

  const sourceTitleRows = (await sql`
    SELECT course_title FROM courses WHERE id = ${input.sourceCourseId} LIMIT 1
  `) as { course_title: string | null }[]

  const destinationCourseId = await resolveExchangeDestinationCourseId(
    input.requesterInstructorId,
    source.course_code,
    input.requesterInstitution ?? requester?.institution ?? null,
    input.destinationCourseId,
    {
      baseTitle: sourceTitleRows[0]?.course_title ?? source.course_code,
      university: input.requesterInstitution ?? requester?.institution ?? null,
    },
  )

  const allowed = normalizeModuleList(source.shareable_modules)
  const allowedSet = new Set(allowed.length > 0 ? allowed : defaultApprovalModules())
  const requestedModulesRaw = normalizeModuleList(input.requestedModules ?? defaultRequestedModules()).filter((m) =>
    allowedSet.has(m),
  )
  const requestedModules = await modulesAllowedForDestination(
    requestedModulesRaw,
    destinationCourseId,
    input.destinationSessionId,
  )
  if (requestedModules.length === 0) {
    throw new Error("Select at least one shareable module for this course.")
  }
  const modulesJson = JSON.stringify(requestedModules)
  const autoApprove = Boolean(
    source.auto_approve === true || source.auto_approve === "t" || source.auto_approve === 1,
  )

  const inserted = (await sql`
    INSERT INTO course_exchange_requests (
      source_course_id,
      source_instructor_id,
      requester_instructor_id,
      purpose,
      requester_institution,
      requester_department,
      requested_modules,
      destination_course_id,
      destination_session_id,
      status
    )
    VALUES (
      ${input.sourceCourseId},
      ${source.instructor_id},
      ${input.requesterInstructorId},
      ${input.purpose ?? null},
      ${input.requesterInstitution ?? requester?.institution ?? null},
      ${input.requesterDepartment ?? requester?.job_title ?? null},
      ${modulesJson}::jsonb,
      ${destinationCourseId},
      ${input.destinationSessionId ?? null},
      'PENDING'
    )
    RETURNING *
  `) as CourseExchangeRequestRow[]

  const request = formatRequestRow(inserted[0])

  await writeAccessLog({
    courseId: input.sourceCourseId,
    sourceInstructorId: Number(source.instructor_id),
    requesterInstructorId: input.requesterInstructorId,
    requestId: request.id,
    eventType: "requested",
    modules: requestedModules,
    autoApproved: autoApprove,
    note: `${requester?.name ?? "Faculty"} requested ${requestedModules.length} module(s)`,
  })

  if (autoApprove) {
    const approved = await approveCourseExchangeRequest({
      instructorId: Number(source.instructor_id),
      requestId: request.id,
      approvedModules: requestedModules,
      deferImport: true,
    })
    await writeAccessLog({
      courseId: input.sourceCourseId,
      sourceInstructorId: Number(source.instructor_id),
      requesterInstructorId: input.requesterInstructorId,
      requestId: request.id,
      eventType: "auto_approved",
      modules: requestedModules,
      autoApproved: true,
      note: "Auto-approved by course sharing settings",
    })

    const copy = await executeApprovedCourseCopy({
      requesterInstructorId: input.requesterInstructorId,
      requestId: request.id,
      destinationCourseId,
      destinationSessionId: input.destinationSessionId ?? null,
    })

    await writeAccessLog({
      courseId: input.sourceCourseId,
      sourceInstructorId: Number(source.instructor_id),
      requesterInstructorId: input.requesterInstructorId,
      requestId: request.id,
      eventType: "copied",
      modules: requestedModules,
      autoApproved: true,
      note: "Materials imported into requester course",
    })

    return {
      ...(copy.request ?? approved.request),
      autoApproved: true as const,
      imported: true as const,
      cloneSummary: copy.cloneSummary,
      attribution: copy.attribution,
      postCopyChecklist: copy.postCopyChecklist,
    }
  }

  await notifyCourseExchangeRequestReceived({
    sourceCourseCode: source.course_code,
    requesterName: requester?.name ?? "A faculty member",
    requestId: request.id,
    sourceInstructorId: Number(source.instructor_id),
  })
  return { ...request, autoApproved: false as const, imported: false as const }
}

export async function listCourseExchangeAccessLog(instructorId: number): Promise<CourseExchangeAccessLogRow[]> {
  await ensureCourseExchangeSchema()
  const rows = (await sql`
    SELECT
      log.id,
      log.course_id,
      c.course_code,
      c.course_title,
      ri.name AS requester_name,
      log.event_type,
      log.modules,
      log.auto_approved,
      log.note,
      log.created_at
    FROM course_exchange_access_log log
    JOIN courses c ON c.id = log.course_id
    JOIN instructors ri ON ri.id = log.requester_instructor_id
    WHERE log.source_instructor_id = ${instructorId}
    ORDER BY log.created_at DESC
    LIMIT 150
  `) as Array<Record<string, unknown>>

  return rows.map((r) => ({
    id: Number(r.id),
    courseId: Number(r.course_id),
    courseCode: String(r.course_code),
    courseTitle: String(r.course_title),
    requesterName: String(r.requester_name),
    eventType: String(r.event_type),
    modules: normalizeModuleList(r.modules),
    autoApproved: Boolean(r.auto_approved === true || r.auto_approved === "t" || r.auto_approved === 1),
    note: r.note != null ? String(r.note) : null,
    createdAt: String(r.created_at),
  }))
}

export async function listReceivedExchangeRequests(instructorId: number, status?: string) {
  await ensureCourseExchangeSchema()
  const st = status?.toUpperCase() ?? null
  const rows = st
    ? ((await sql`
        SELECT
          r.*,
          c.course_code,
          c.course_title,
          ri.name AS requester_name,
          copy.approved_modules AS copy_approved_modules,
          ces.shareable_modules
        FROM course_exchange_requests r
        JOIN courses c ON c.id = r.source_course_id
        JOIN instructors ri ON ri.id = r.requester_instructor_id
        LEFT JOIN course_exchange_copies copy ON copy.request_id = r.id
        LEFT JOIN course_exchange_settings ces ON ces.course_id = r.source_course_id
        WHERE r.source_instructor_id = ${instructorId}
          AND r.status = ${st}
        ORDER BY r.created_at DESC
        LIMIT 100
      `) as (CourseExchangeRequestRow & {
        course_code: string
        course_title: string
        requester_name: string
        copy_approved_modules: unknown
        shareable_modules: unknown
      })[])
    : ((await sql`
        SELECT
          r.*,
          c.course_code,
          c.course_title,
          ri.name AS requester_name,
          copy.approved_modules AS copy_approved_modules,
          ces.shareable_modules
        FROM course_exchange_requests r
        JOIN courses c ON c.id = r.source_course_id
        JOIN instructors ri ON ri.id = r.requester_instructor_id
        LEFT JOIN course_exchange_copies copy ON copy.request_id = r.id
        LEFT JOIN course_exchange_settings ces ON ces.course_id = r.source_course_id
        WHERE r.source_instructor_id = ${instructorId}
        ORDER BY r.created_at DESC
        LIMIT 100
      `) as (CourseExchangeRequestRow & {
        course_code: string
        course_title: string
        requester_name: string
        copy_approved_modules: unknown
        shareable_modules: unknown
      })[])

  return rows.map((r) => {
    const formatted = formatRequestRow(r)
    const shareable = normalizeModuleList(r.shareable_modules)
    const shareableModules = shareable.length > 0 ? shareable : defaultApprovalModules()
    const copyApprovedModules = r.copy_approved_modules
      ? normalizeModuleList(r.copy_approved_modules)
      : null
    const pendingSupplementModules = exchangePendingSupplementModules(
      formatted.requested_modules,
      copyApprovedModules,
    )
    return {
      ...formatted,
      courseCode: r.course_code,
      courseTitle: r.course_title,
      requesterName: r.requester_name,
      shareableModules,
      copyApprovedModules,
      pendingSupplementModules,
      needsReview: requestNeedsCreatorReview(formatted.status, formatted.requested_modules, copyApprovedModules),
    }
  })
}

export async function listSentExchangeRequests(instructorId: number, status?: string) {
  await ensureCourseExchangeSchema()
  const st = status?.toUpperCase() ?? null
  const rows = st
    ? ((await sql`
        SELECT
          r.*,
          c.course_code,
          c.course_title,
          si.name AS creator_name,
          copy.id AS copy_id,
          copy.approved_modules AS copy_approved_modules,
          ces.shareable_modules
        FROM course_exchange_requests r
        JOIN courses c ON c.id = r.source_course_id
        JOIN instructors si ON si.id = r.source_instructor_id
        LEFT JOIN course_exchange_copies copy ON copy.request_id = r.id
        LEFT JOIN course_exchange_settings ces ON ces.course_id = r.source_course_id
        WHERE r.requester_instructor_id = ${instructorId}
          AND r.status = ${st}
        ORDER BY r.created_at DESC
        LIMIT 100
      `) as (CourseExchangeRequestRow & {
        course_code: string
        course_title: string
        creator_name: string
        copy_id: number | null
        copy_approved_modules: unknown
        shareable_modules: unknown
      })[])
    : ((await sql`
        SELECT
          r.*,
          c.course_code,
          c.course_title,
          si.name AS creator_name,
          copy.id AS copy_id,
          copy.approved_modules AS copy_approved_modules,
          ces.shareable_modules
        FROM course_exchange_requests r
        JOIN courses c ON c.id = r.source_course_id
        JOIN instructors si ON si.id = r.source_instructor_id
        LEFT JOIN course_exchange_copies copy ON copy.request_id = r.id
        LEFT JOIN course_exchange_settings ces ON ces.course_id = r.source_course_id
        WHERE r.requester_instructor_id = ${instructorId}
        ORDER BY r.created_at DESC
        LIMIT 100
      `) as (CourseExchangeRequestRow & {
        course_code: string
        course_title: string
        creator_name: string
        copy_id: number | null
        copy_approved_modules: unknown
        shareable_modules: unknown
      })[])

  return rows.map((r) => {
    const shareable = normalizeModuleList(r.shareable_modules)
    const shareableModules = shareable.length > 0 ? shareable : defaultApprovalModules()
    const imported = normalizeModuleList(r.copy_approved_modules ?? r.approved_modules ?? r.requested_modules)
    return {
      ...formatRequestRow(r),
      courseCode: r.course_code,
      courseTitle: r.course_title,
      creatorName: r.creator_name,
      copyId: r.copy_id != null ? Number(r.copy_id) : null,
      shareableModules,
      missingModules: exchangeMissingShareableModules(shareableModules, imported),
    }
  })
}

export async function listSharedWithMe(instructorId: number) {
  await ensureCourseExchangeSchema()
  const rows = (await sql`
    SELECT
      copy.*,
      r.status,
      r.completed_at,
      sc.course_code AS destination_course_code,
      sc.course_title AS destination_course_title,
      src.course_code AS source_course_code,
      src.course_title AS source_course_title,
      si.name AS source_instructor_name
    FROM course_exchange_copies copy
    JOIN course_exchange_requests r ON r.id = copy.request_id
    JOIN courses sc ON sc.id = copy.destination_course_id
    JOIN courses src ON src.id = copy.source_course_id
    JOIN instructors si ON si.id = copy.source_instructor_id
    WHERE copy.destination_instructor_id = ${instructorId}
    ORDER BY copy.created_at DESC
    LIMIT 100
  `) as Record<string, unknown>[]
  return rows
}

export async function listMySharedCourses(instructorId: number) {
  await ensureCourseExchangeSchema()
  const rows = (await sql`
    SELECT
      copy.*,
      r.status,
      dc.course_code AS destination_course_code,
      sc.course_code AS source_course_code,
      sc.course_title AS source_course_title,
      ri.name AS requester_name
    FROM course_exchange_copies copy
    JOIN course_exchange_requests r ON r.id = copy.request_id
    JOIN courses sc ON sc.id = copy.source_course_id
    JOIN courses dc ON dc.id = copy.destination_course_id
    JOIN instructors ri ON ri.id = copy.destination_instructor_id
    WHERE copy.source_instructor_id = ${instructorId}
    ORDER BY copy.created_at DESC
    LIMIT 100
  `) as Record<string, unknown>[]
  return rows
}

export async function rejectCourseExchangeRequest(input: {
  instructorId: number
  requestId: number
  reason?: string | null
}) {
  await ensureCourseExchangeSchema()
  const request = await loadExchangeRequest(input.requestId)
  if (!request) throw new Error("Request not found.")
  const canReview = await assertCreatorCanReview(input.instructorId, request)
  if (!canReview.ok) throw new Error(canReview.reason)

  const updated = (await sql`
    UPDATE course_exchange_requests
    SET status = 'REJECTED',
        rejection_reason = ${input.reason ?? null},
        rejected_at = NOW(),
        reviewed_at = NOW(),
        reviewed_by = ${input.instructorId}
    WHERE id = ${input.requestId}
    RETURNING *
  `) as CourseExchangeRequestRow[]

  const sourceRows = (await sql`
    SELECT course_code FROM courses WHERE id = ${request.source_course_id} LIMIT 1
  `) as { course_code: string }[]
  const ownerRows = (await sql`
    SELECT name FROM instructors WHERE id = ${input.instructorId} LIMIT 1
  `) as { name: string }[]

  await notifyCourseExchangeRejected({
    sourceCourseCode: sourceRows[0]?.course_code ?? "course",
    requestId: input.requestId,
    requesterInstructorId: Number(request.requester_instructor_id),
    ownerName: String(ownerRows[0]?.name ?? "The course owner"),
    reason: input.reason,
  })

  return formatRequestRow(updated[0])
}

export async function approveCourseExchangeRequest(input: {
  instructorId: number
  requestId: number
  approvedModules: CourseExchangeModule[]
  /** Skip import — used by auto-approve flow which imports separately. */
  deferImport?: boolean
}) {
  await ensureCourseExchangeSchema()
  const request = await loadExchangeRequest(input.requestId)
  if (!request) throw new Error("Request not found.")

  const existingCopyEarly = await loadCopyByRequestId(input.requestId)
  const copyApprovedEarly = existingCopyEarly
    ? normalizeModuleList(existingCopyEarly.approved_modules)
    : []
  const supplementPending =
    copyApprovedEarly.length > 0 &&
    exchangePendingSupplementModules(request.requested_modules, copyApprovedEarly).length > 0

  const canReview = await assertCreatorCanReview(input.instructorId, request)
  if (!canReview.ok && !supplementPending) throw new Error(canReview.reason)
  if (
    !canReview.ok &&
    supplementPending &&
    !["PENDING", "APPROVED", "COMPLETED"].includes(request.status.toUpperCase())
  ) {
    throw new Error(canReview.reason)
  }

  const approvedModules = normalizeModuleList(input.approvedModules)
  if (approvedModules.length === 0) {
    throw new Error("Select at least one content category to share.")
  }

  const settings = await getCourseSharingSettings(request.source_course_id)
  const allowed = new Set(settings?.shareableModules ?? defaultApprovalModules())
  const filteredApprovedRaw = approvedModules.filter((m) => allowed.has(m))
  const filteredApproved = await modulesAllowedForDestination(
    filteredApprovedRaw,
    request.destination_course_id,
    request.destination_session_id,
  )
  if (filteredApproved.length === 0) {
    throw new Error("Approved modules must be within the course's shareable modules.")
  }

  const modulesJson = JSON.stringify(filteredApproved)
  const updated = (await sql`
    UPDATE course_exchange_requests
    SET status = 'APPROVED',
        approved_modules = ${modulesJson}::jsonb,
        reviewed_at = NOW(),
        reviewed_by = ${input.instructorId}
    WHERE id = ${input.requestId}
    RETURNING *
  `) as CourseExchangeRequestRow[]

  const sourceRows = (await sql`
    SELECT course_code FROM courses WHERE id = ${request.source_course_id} LIMIT 1
  `) as { course_code: string }[]

  const formatted = formatRequestRow(updated[0])
  await writeAccessLog({
    courseId: request.source_course_id,
    sourceInstructorId: request.source_instructor_id,
    requesterInstructorId: request.requester_instructor_id,
    requestId: input.requestId,
    eventType: "approved",
    modules: filteredApproved,
    autoApproved: false,
    note: "Manually approved by course owner",
  })

  const sourceCourseCode = sourceRows[0]?.course_code ?? "course"
  const ownerRows = (await sql`
    SELECT name FROM instructors WHERE id = ${request.source_instructor_id} LIMIT 1
  `) as { name: string | null }[]
  const ownerName = String(ownerRows[0]?.name ?? "The course owner").trim() || "The course owner"
  const existingCopy = existingCopyEarly

  if (existingCopy) {
    const priorApproved = normalizeModuleList(existingCopy.approved_modules)
    const mergedApproved = [...new Set([...priorApproved, ...filteredApproved])]
    const mergedJson = JSON.stringify(mergedApproved)
    const delta = filteredApproved.filter((m) => !priorApproved.includes(m))
    if (delta.length > 0) {
      await applyCopyModuleSupplement({
        copyId: Number(existingCopy.id),
        requesterInstructorId: Number(request.requester_instructor_id),
        modules: delta,
        note: "Approved supplement by course owner",
      })
    }

    await sql`
      UPDATE course_exchange_requests
      SET status = 'COMPLETED',
          approved_modules = ${mergedJson}::jsonb,
          requested_modules = ${mergedJson}::jsonb,
          reviewed_at = NOW(),
          reviewed_by = ${input.instructorId}
      WHERE id = ${input.requestId}
    `

    const refreshed = (await loadExchangeRequest(input.requestId))!
    await notifyCourseExchangeApproved({
      sourceCourseCode,
      requestId: input.requestId,
      requesterInstructorId: Number(request.requester_instructor_id),
      ownerName,
      imported: true,
    })
    return {
      request: formatRequestRow(refreshed),
      imported: true as const,
      supplemented: delta.length > 0,
    }
  }

  if (!input.deferImport && request.destination_course_id) {
    const copy = await executeApprovedCourseCopy({
      requesterInstructorId: Number(request.requester_instructor_id),
      requestId: input.requestId,
      destinationCourseId: Number(request.destination_course_id),
      destinationSessionId: request.destination_session_id ?? null,
    })

    await notifyCourseExchangeApproved({
      sourceCourseCode,
      requestId: input.requestId,
      requesterInstructorId: Number(request.requester_instructor_id),
      ownerName,
      imported: true,
    })

    await writeAccessLog({
      courseId: request.source_course_id,
      sourceInstructorId: request.source_instructor_id,
      requesterInstructorId: request.requester_instructor_id,
      requestId: input.requestId,
      eventType: "copied",
      modules: filteredApproved,
      autoApproved: false,
      note: "Materials imported after manual approval",
    })

    return {
      request: copy.request,
      imported: true as const,
      cloneSummary: copy.cloneSummary,
      attribution: copy.attribution,
      postCopyChecklist: copy.postCopyChecklist,
    }
  }

  await notifyCourseExchangeApproved({
    sourceCourseCode,
    requestId: input.requestId,
    requesterInstructorId: Number(request.requester_instructor_id),
    ownerName,
    imported: false,
  })

  return { request: formatted, imported: false as const }
}

export async function executeApprovedCourseCopy(input: {
  requesterInstructorId: number
  requestId: number
  destinationCourseId: number
  destinationSessionId?: number | null
}) {
  await ensureCourseExchangeSchema()
  const faculty = await assertActiveFaculty(input.requesterInstructorId)
  if (!faculty.ok) throw new Error(faculty.reason)

  let request = await loadExchangeRequest(input.requestId)
  if (!request) throw new Error("Request not found.")

  if (request.status === "COMPLETED") {
    const existing = (await sql`
      SELECT attribution, clone_summary FROM course_exchange_copies
      WHERE request_id = ${input.requestId}
      LIMIT 1
    `) as { attribution: CourseExchangeAttribution; clone_summary: Record<string, unknown> }[]
    if (existing[0]) {
      return {
        request: formatRequestRow(request),
        cloneSummary: existing[0].clone_summary,
        attribution: existing[0].attribution,
        postCopyChecklist: [...POST_COPY_CHECKLIST],
      }
    }
  }

  const canImport = await assertRequesterCanImport(input.requesterInstructorId, request)
  if (!canImport.ok) throw new Error(canImport.reason)

  const destOwned = await assertDestinationOwnedByRequester(
    input.requesterInstructorId,
    input.destinationCourseId,
  )
  if (!destOwned.ok) throw new Error(destOwned.reason)

  const approvedModulesRaw = resolveApprovedModules(request)
  const retryingFailedImport = request.status === "FAILED"

  const destinationSessionId =
    input.destinationSessionId ?? request.destination_session_id ?? null
  if (destinationSessionId != null && Number.isFinite(Number(destinationSessionId))) {
    const sessRows = (await sql`
      SELECT id, code, course_id FROM sessions
      WHERE id = ${Number(destinationSessionId)}
      LIMIT 1
    `) as { id: number; code: string; course_id: number }[]
    const sess = sessRows[0]
    if (!sess) throw new Error("Destination section not found.")
    if (Number(sess.course_id) !== input.destinationCourseId) {
      throw new Error("Destination section does not belong to the selected course.")
    }
  }

  const destinationSessionCode = await resolveExchangeDestinationSessionCode(
    input.destinationCourseId,
    destinationSessionId,
  )
  const { modules: approvedModules } = filterGroupsProjectsForOwnSession(
    approvedModulesRaw,
    destinationSessionCode,
  )
  if (approvedModules.length === 0) {
    throw new Error("No modules remain to import for this destination section.")
  }

  const locked = (await sql`
    UPDATE course_exchange_requests
    SET status = 'COPYING',
        destination_course_id = ${input.destinationCourseId},
        destination_session_id = ${destinationSessionId},
        clone_error = NULL
    WHERE id = ${input.requestId}
      AND status IN ('APPROVED', 'FAILED')
    RETURNING *
  `) as CourseExchangeRequestRow[]

  if (locked.length === 0) {
    request = (await loadExchangeRequest(input.requestId))!
    if (request?.status === "COMPLETED") {
      const existing = (await sql`
        SELECT attribution, clone_summary FROM course_exchange_copies
        WHERE request_id = ${input.requestId}
        LIMIT 1
      `) as { attribution: CourseExchangeAttribution; clone_summary: Record<string, unknown> }[]
      if (existing[0]) {
        return {
          request: formatRequestRow(request),
          cloneSummary: existing[0].clone_summary,
          attribution: existing[0].attribution,
          postCopyChecklist: [...POST_COPY_CHECKLIST],
        }
      }
    }
    if (request?.status === "COPYING") {
      throw new Error("Import is already in progress. Please wait a moment and refresh.")
    }
    throw new Error("Request cannot be imported in its current state.")
  }

  request = locked[0]

  try {
    if (retryingFailedImport) {
      await clearDestinationExchangeContent(input.destinationCourseId)
      await sql`DELETE FROM course_exchange_copies WHERE request_id = ${input.requestId}`
    }

    const cloneResult = await cloneCourseContent({
      sourceCourseId: request.source_course_id,
      destinationCourseId: input.destinationCourseId,
      destinationInstructorId: input.requesterInstructorId,
      destinationSessionCode,
      destinationSessionId,
      selectedModules: approvedModules,
    })

    const sourceMeta = (await sql`
      SELECT c.course_code, c.course_title, c.semester, i.name
      FROM courses c
      JOIN instructors i ON i.id = c.instructor_id
      WHERE c.id = ${request.source_course_id}
      LIMIT 1
    `) as { course_code: string; course_title: string; semester: string | null; name: string }[]

    const destInstructor = (await sql`
      SELECT name FROM instructors WHERE id = ${input.requesterInstructorId} LIMIT 1
    `) as { name: string }[]

    const attribution: CourseExchangeAttribution = {
      sourceInstructorName: sourceMeta[0]?.name ?? "Unknown",
      sourceCourseCode: sourceMeta[0]?.course_code ?? "",
      sourceCourseTitle: sourceMeta[0]?.course_title ?? "",
      sourceTermLabel: sourceMeta[0]?.semester,
      destinationInstructorName: destInstructor[0]?.name ?? null,
      copiedAt: new Date().toISOString(),
      requestId: input.requestId,
    }

    await sql`
      UPDATE courses
      SET exchange_provenance = ${JSON.stringify(attribution)}::jsonb,
          updated_at = NOW()
      WHERE id = ${input.destinationCourseId}
    `

    await sql`
      INSERT INTO course_exchange_copies (
        request_id,
        source_course_id,
        destination_course_id,
        source_instructor_id,
        destination_instructor_id,
        approved_modules,
        attribution,
        clone_summary
      )
      VALUES (
        ${input.requestId},
        ${request.source_course_id},
        ${input.destinationCourseId},
        ${request.source_instructor_id},
        ${input.requesterInstructorId},
        ${JSON.stringify(approvedModules)}::jsonb,
        ${JSON.stringify(attribution)}::jsonb,
        ${JSON.stringify(cloneResult.summary)}::jsonb
      )
      ON CONFLICT (request_id) DO UPDATE SET
        destination_course_id = EXCLUDED.destination_course_id,
        approved_modules = EXCLUDED.approved_modules,
        attribution = EXCLUDED.attribution,
        clone_summary = EXCLUDED.clone_summary
      RETURNING id
    `

    const lineage = await buildExchangeLineage({
      sourceCourseId: request.source_course_id,
      destinationCourseId: input.destinationCourseId,
      maps: cloneResult.maps,
      modules: approvedModules,
      version: 1,
    })

    await sql`
      UPDATE course_exchange_copies
      SET lineage = ${JSON.stringify(lineage)}::jsonb,
          sync_version = 1,
          last_synced_at = NOW(),
          pending_update_count = 0
      WHERE request_id = ${input.requestId}
    `

    const sourceNow = await buildSourceManifestBatch(request.source_course_id, approvedModules)
    const manifestHash = hashSourceManifest(sourceNow.values())
    const copyRows = (await sql`
      SELECT id FROM course_exchange_copies WHERE request_id = ${input.requestId} LIMIT 1
    `) as { id: number }[]
    const copyId = copyRows[0]?.id
    if (copyId) {
      const codeRows = (await sql`
        SELECT src.course_code AS source_course_code, dst.course_code AS destination_course_code
        FROM course_exchange_copies copy
        JOIN courses src ON src.id = copy.source_course_id
        JOIN courses dst ON dst.id = copy.destination_course_id
        WHERE copy.id = ${copyId}
        LIMIT 1
      `) as { source_course_code: string; destination_course_code: string }[]
      const codes = codeRows[0]
      const emptyDiff = {
        copyId,
        sourceCourseCode: codes?.source_course_code ?? "",
        destinationCourseCode: codes?.destination_course_code ?? "",
        sourceVersion: 1,
        hasUpdates: false,
        changeCount: 0,
        changes: [],
        checkedAt: new Date().toISOString(),
      }
      await sql`
        UPDATE course_exchange_copies
        SET source_manifest_hash = ${manifestHash},
            cached_sync_diff = ${JSON.stringify(emptyDiff)}::jsonb,
            cached_sync_diff_at = NOW()
        WHERE id = ${copyId}
      `
    }

    const updated = (await sql`
      UPDATE course_exchange_requests
      SET status = 'COMPLETED',
          clone_summary = ${JSON.stringify(cloneResult.summary)}::jsonb,
          completed_at = NOW(),
          destination_course_id = ${input.destinationCourseId},
          destination_session_id = ${input.destinationSessionId ?? null}
      WHERE id = ${input.requestId}
      RETURNING *
    `) as CourseExchangeRequestRow[]

    await notifyCourseExchangeCopyCompleted({
      destinationCourseCode: destOwned.course.course_code,
      requestId: input.requestId,
    })

    return {
      request: formatRequestRow(updated[0]),
      cloneSummary: cloneResult.summary,
      attribution,
      postCopyChecklist: [...POST_COPY_CHECKLIST],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await sql`
      UPDATE course_exchange_requests
      SET status = 'FAILED', clone_error = ${message}
      WHERE id = ${input.requestId}
    `
    const sourceRows = (await sql`
      SELECT course_code FROM courses WHERE id = ${request.source_course_id} LIMIT 1
    `) as { course_code: string }[]
    await notifyCourseExchangeCopyFailed({
      sourceCourseCode: sourceRows[0]?.course_code ?? "course",
      requestId: input.requestId,
      error: message,
    })
    throw error
  }
}

export async function applyCopyModuleSupplement(input: {
  copyId: number
  requesterInstructorId: number
  modules: CourseExchangeModule[]
  note?: string | null
}) {
  await ensureCourseExchangeSchema()
  const faculty = await assertActiveFaculty(input.requesterInstructorId)
  if (!faculty.ok) throw new Error(faculty.reason)

  const rows = (await sql`
    SELECT
      copy.*,
      r.id AS request_id,
      r.source_course_id,
      r.source_instructor_id,
      r.requester_instructor_id,
      r.destination_session_id
    FROM course_exchange_copies copy
    JOIN course_exchange_requests r ON r.id = copy.request_id
    WHERE copy.id = ${input.copyId}
      AND copy.destination_instructor_id = ${input.requesterInstructorId}
    LIMIT 1
  `) as Array<Record<string, unknown>>
  const copy = rows[0]
  if (!copy) throw new Error("Copy not found.")

  const priorApproved = normalizeModuleList(copy.approved_modules)
  const delta = normalizeModuleList(input.modules).filter((m) => !priorApproved.includes(m))
  if (delta.length === 0) {
    return { summary: {}, approvedModules: priorApproved, applied: 0 }
  }

  const settings = await getCourseSharingSettings(Number(copy.source_course_id))
  const shareable = new Set(settings?.shareableModules ?? defaultApprovalModules())
  for (const mod of delta) {
    if (!shareable.has(mod)) {
      throw new Error(`Module "${COURSE_EXCHANGE_MODULE_LABELS[mod]}" is not shareable for this course.`)
    }
  }

  const lineage = parseExchangeLineage(copy.lineage)
  if (!lineage) throw new Error("Lineage missing for this copy. Contact support to rebuild lineage.")
  const maps = lineageToIdMaps(lineage)

  const destinationSessionCode = await resolveExchangeDestinationSessionCode(
    Number(copy.destination_course_id),
    copy.destination_session_id != null ? Number(copy.destination_session_id) : null,
  )
  const { modules: deltaToClone } = filterGroupsProjectsForOwnSession(delta, destinationSessionCode)
  if (deltaToClone.length === 0) {
    return { summary: {}, approvedModules: priorApproved, applied: 0 }
  }

  const cloneResult = await cloneCourseContent({
    sourceCourseId: Number(copy.source_course_id),
    destinationCourseId: Number(copy.destination_course_id),
    destinationInstructorId: input.requesterInstructorId,
    destinationSessionCode,
    destinationSessionId:
      copy.destination_session_id != null ? Number(copy.destination_session_id) : null,
    selectedModules: deltaToClone,
    maps,
    reuseMaps: maps,
  })

  const mergedApproved = [...new Set([...priorApproved, ...deltaToClone])]
  const priorSummary =
    copy.clone_summary && typeof copy.clone_summary === "object"
      ? (copy.clone_summary as Record<string, number>)
      : {}
  const mergedSummary = { ...priorSummary }
  for (const [k, v] of Object.entries(cloneResult.summary)) {
    mergedSummary[k] = (mergedSummary[k] ?? 0) + v
  }

  const nextLineage = await buildExchangeLineage({
    sourceCourseId: Number(copy.source_course_id),
    destinationCourseId: Number(copy.destination_course_id),
    maps: cloneResult.maps,
    modules: mergedApproved,
    version: Number(copy.sync_version ?? 1) + 1,
  })

  await sql`
    UPDATE course_exchange_copies
    SET approved_modules = ${JSON.stringify(mergedApproved)}::jsonb,
        clone_summary = ${JSON.stringify(mergedSummary)}::jsonb,
        lineage = ${JSON.stringify(nextLineage)}::jsonb,
        sync_version = COALESCE(sync_version, 1) + 1,
        last_synced_at = NOW()
    WHERE id = ${input.copyId}
  `

  const requestRow = await loadExchangeRequest(Number(copy.request_id))
  const mergedRequested = requestRow
    ? [...new Set([...requestRow.requested_modules, ...deltaToClone])]
    : mergedApproved

  await sql`
    UPDATE course_exchange_requests
    SET approved_modules = ${JSON.stringify(mergedApproved)}::jsonb,
        requested_modules = ${JSON.stringify(mergedRequested)}::jsonb,
        clone_summary = ${JSON.stringify(mergedSummary)}::jsonb,
        status = 'COMPLETED',
        completed_at = COALESCE(completed_at, NOW())
    WHERE id = ${Number(copy.request_id)}
  `

  const sourceNow = await buildSourceManifestBatch(Number(copy.source_course_id), mergedApproved)
  const manifestHash = hashSourceManifest(sourceNow.values())
  await sql`
    UPDATE course_exchange_copies
    SET source_manifest_hash = ${manifestHash},
        pending_update_count = 0,
        cached_sync_diff_at = NULL,
        cached_sync_diff = NULL
    WHERE id = ${input.copyId}
  `

  await writeAccessLog({
    courseId: Number(copy.source_course_id),
    sourceInstructorId: Number(copy.source_instructor_id),
    requesterInstructorId: Number(copy.requester_instructor_id),
    requestId: Number(copy.request_id),
    eventType: "supplemented",
    modules: delta,
    note: input.note ?? "Additional modules imported into destination course",
  })

  return {
    summary: cloneResult.summary,
    approvedModules: mergedApproved,
    applied: delta.length,
  }
}

export async function requestCourseExchangeSupplement(input: {
  requesterInstructorId: number
  requestId: number
  modules: CourseExchangeModule[]
}) {
  await ensureCourseExchangeSchema()
  const request = await loadExchangeRequest(input.requestId)
  if (!request) throw new Error("Request not found.")
  if (Number(request.requester_instructor_id) !== input.requesterInstructorId) {
    throw new Error("Only the requester can add modules to this exchange.")
  }
  if (request.status === "REJECTED" || request.status === "CANCELLED") {
    throw new Error("This request can no longer be updated.")
  }

  const settings = await getCourseSharingSettings(request.source_course_id)
  const shareable = settings?.shareableModules ?? defaultApprovalModules()
  const shareableSet = new Set(shareable)
  const copyRow = await loadCopyByRequestId(input.requestId)
  const importedModules = copyRow
    ? normalizeModuleList(copyRow.approved_modules)
    : resolveApprovedModules(request)

  const newModules = normalizeModuleList(input.modules).filter(
    (m) => shareableSet.has(m) && !importedModules.includes(m),
  )
  if (newModules.length === 0) {
    throw new Error("Only modules the creator shares can be requested, and they must not already be imported.")
  }

  const needsCreatorApproval =
    !settings?.autoApprove ||
    newModules.some((m) => COURSE_EXCHANGE_SENSITIVE_MODULES.includes(m))

  if (needsCreatorApproval) {
    const mergedRequested = [...new Set([...request.requested_modules, ...newModules])]
    await sql`
      UPDATE course_exchange_requests
      SET status = 'PENDING',
          requested_modules = ${JSON.stringify(mergedRequested)}::jsonb,
          reviewed_at = NULL,
          reviewed_by = NULL,
          rejection_reason = NULL,
          rejected_at = NULL
      WHERE id = ${input.requestId}
    `

    const sourceRows = (await sql`
      SELECT course_code FROM courses WHERE id = ${request.source_course_id} LIMIT 1
    `) as { course_code: string }[]
    const requesterRows = (await sql`
      SELECT name FROM instructors WHERE id = ${input.requesterInstructorId} LIMIT 1
    `) as { name: string }[]

    await writeAccessLog({
      courseId: request.source_course_id,
      sourceInstructorId: request.source_instructor_id,
      requesterInstructorId: input.requesterInstructorId,
      requestId: input.requestId,
      eventType: "supplement_requested",
      modules: newModules,
      note: "Requester asked to import additional modules",
    })

    await notifyCourseExchangeSupplementRequested({
      sourceCourseCode: sourceRows[0]?.course_code ?? "course",
      requesterName: requesterRows[0]?.name ?? "A faculty member",
      requestId: input.requestId,
      modules: newModules.map((m) => COURSE_EXCHANGE_MODULE_LABELS[m]),
      sourceInstructorId: Number(request.source_instructor_id),
    })

    const refreshed = (await loadExchangeRequest(input.requestId))!
    return {
      needsApproval: true as const,
      request: formatRequestRow(refreshed),
      modules: newModules,
    }
  }

  if (copyRow) {
    const result = await applyCopyModuleSupplement({
      copyId: Number(copyRow.id),
      requesterInstructorId: input.requesterInstructorId,
      modules: newModules,
      note: "Auto-imported additional modules",
    })
    const refreshed = (await loadExchangeRequest(input.requestId))!
    return {
      needsApproval: false as const,
      request: formatRequestRow(refreshed),
      modules: newModules,
      summary: result.summary,
    }
  }

  const mergedApproved = [...new Set([...resolveApprovedModules(request), ...newModules])]
  const mergedRequested = [...new Set([...request.requested_modules, ...newModules])]
  await sql`
    UPDATE course_exchange_requests
    SET approved_modules = ${JSON.stringify(mergedApproved)}::jsonb,
        requested_modules = ${JSON.stringify(mergedRequested)}::jsonb,
        status = 'APPROVED'
    WHERE id = ${input.requestId}
  `

  await writeAccessLog({
    courseId: request.source_course_id,
    sourceInstructorId: request.source_instructor_id,
    requesterInstructorId: input.requesterInstructorId,
    requestId: input.requestId,
    eventType: "supplemented",
    modules: newModules,
    autoApproved: true,
    note: "Modules approved before initial import",
  })

  const refreshed = (await loadExchangeRequest(input.requestId))!
  return {
    needsApproval: false as const,
    request: formatRequestRow(refreshed),
    modules: newModules,
  }
}

export async function getExchangeRequestTimeline(input: {
  instructorId: number
  requestId: number
}): Promise<ExchangeTimelineEntry[]> {
  await ensureCourseExchangeSchema()
  const request = await loadExchangeRequest(input.requestId)
  if (!request) throw new Error("Request not found.")

  const isRequester = Number(request.requester_instructor_id) === input.instructorId
  const isCreator = Number(request.source_instructor_id) === input.instructorId
  if (!isRequester && !isCreator) {
    throw new Error("You do not have access to this request timeline.")
  }

  const names = (await sql`
    SELECT
      ri.name AS requester_name,
      si.name AS creator_name
    FROM course_exchange_requests r
    JOIN instructors ri ON ri.id = r.requester_instructor_id
    JOIN instructors si ON si.id = r.source_instructor_id
    WHERE r.id = ${input.requestId}
    LIMIT 1
  `) as { requester_name: string; creator_name: string }[]
  const requesterName = names[0]?.requester_name ?? "Requester"
  const creatorName = names[0]?.creator_name ?? "Course owner"

  const logRows = (await sql`
    SELECT id, event_type, modules, note, auto_approved, created_at, requester_instructor_id, source_instructor_id
    FROM course_exchange_access_log
    WHERE request_id = ${input.requestId}
    ORDER BY created_at ASC
  `) as Array<Record<string, unknown>>

  const entries: ExchangeTimelineEntry[] = logRows.map((row) => {
    const eventType = String(row.event_type)
    const byRequester = Number(row.requester_instructor_id) === input.instructorId && isRequester
    const actor =
      eventType === "requested" || eventType === "supplement_requested"
        ? "requester"
        : eventType === "approved" || eventType === "rejected"
          ? "creator"
          : "system"
    return {
      id: `log-${row.id}`,
      at: String(row.created_at),
      actor,
      actorName:
        actor === "requester"
          ? requesterName
          : actor === "creator"
            ? creatorName
            : byRequester
              ? requesterName
              : creatorName,
      eventType,
      label: timelineLabel(eventType),
      modules: normalizeModuleList(row.modules),
      note: row.note != null ? String(row.note) : null,
    }
  })

  const lifecycle: Array<{ id: string; at: string; label: string; actor: ExchangeTimelineEntry["actor"] }> = []
  if (request.created_at) {
    lifecycle.push({ id: "life-created", at: request.created_at, label: "Request created", actor: "requester" })
  }
  if (request.reviewed_at) {
    lifecycle.push({ id: "life-reviewed", at: request.reviewed_at, label: "Owner review recorded", actor: "creator" })
  }
  if (request.completed_at) {
    lifecycle.push({ id: "life-completed", at: request.completed_at, label: "Import completed", actor: "system" })
  }
  if (request.rejected_at) {
    lifecycle.push({ id: "life-rejected", at: request.rejected_at, label: "Request declined", actor: "creator" })
  }

  for (const item of lifecycle) {
    if (!entries.some((e) => e.at === item.at && e.label === item.label)) {
      entries.push({
        id: item.id,
        at: item.at,
        actor: item.actor,
        actorName: item.actor === "requester" ? requesterName : item.actor === "creator" ? creatorName : null,
        eventType: item.id,
        label: item.label,
        modules: [],
        note: null,
      })
    }
  }

  entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  return entries
}

export type ExchangeSupplementOptions = {
  importedModules: CourseExchangeModule[]
  shareableModules: CourseExchangeModule[]
  missingShareable: CourseExchangeModule[]
  addableModules: CourseExchangeModule[]
  requiresApproval: CourseExchangeModule[]
}

export async function getExchangeSupplementOptions(input: {
  instructorId: number
  requestId: number
}): Promise<ExchangeSupplementOptions> {
  await ensureCourseExchangeSchema()
  const request = await loadExchangeRequest(input.requestId)
  if (!request) throw new Error("Request not found.")

  const isRequester = Number(request.requester_instructor_id) === input.instructorId
  const isCreator = Number(request.source_instructor_id) === input.instructorId
  if (!isRequester && !isCreator) {
    throw new Error("You do not have access to this request.")
  }

  const settings = await getCourseSharingSettings(request.source_course_id)
  const shareableModules = settings?.shareableModules ?? defaultApprovalModules()
  const copyRow = await loadCopyByRequestId(input.requestId)
  const importedModules = copyRow
    ? normalizeModuleList(copyRow.approved_modules)
    : resolveApprovedModules(request)

  const missingShareable = shareableModules.filter((m) => !importedModules.includes(m))
  const addableModules = missingShareable
  const requiresApproval = addableModules.filter(
    (m) => COURSE_EXCHANGE_SENSITIVE_MODULES.includes(m) || !settings?.autoApprove,
  )

  return {
    importedModules,
    shareableModules,
    missingShareable,
    addableModules,
    requiresApproval,
  }
}

export { defaultApprovalModules, defaultRequestedModules }
