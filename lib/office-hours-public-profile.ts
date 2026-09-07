import { randomBytes } from "crypto"
import { sql } from "@/lib/db"
import { formatAcademicTermLabel, getActiveAcademicTerm } from "@/lib/active-academic-term"
import { getBaseUrl, getPermanentPublicBaseUrl } from "@/lib/get-base-url"
import {
  courseOwnerIdForActor,
  loadInstructorActor,
} from "@/lib/instructor-actor-scope"
import { listFacultyCourseOfferings } from "@/lib/faculty-course-offerings"
import {
  facultyOfferingChipCode,
  facultyOfferingKey,
  type FacultyCourseOffering,
} from "@/lib/faculty-course-offerings-shared"
import { ensureOfficeHoursCourseScopeColumns } from "@/lib/office-hours-course-scope"
import { touchCalendarFeed } from "@/lib/calendar/feed-token"
import { PVAMU_UNIVERSITY_ID } from "@/lib/instructor-university-scope"
import {
  contactFromSyllabusFields,
  getPublishedSyllabusInstructorFields,
  loadSyllabusOfficeHoursForOffering,
  mergeSyllabusContact,
  type SyllabusInstructorContact,
} from "@/lib/office-hours-syllabus-fallback"

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const SLUG_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"

export type OfficeHourSlot = {
  dayOfWeek: number
  dayName: string
  startTime: string
  endTime: string
}

export type OfficeHoursInstructorContact = SyllabusInstructorContact

export type DoorQrCourseHours = {
  courseId: number
  sessionId: number | null
  offeringKey: string
  courseCode: string
  courseTitle: string
  sessionCode: string | null
  officeLocation: string | null
  slots: OfficeHourSlot[]
  hoursSource?: "door" | "syllabus" | "none"
  syllabusHoursSummary?: string | null
  supplementaryNotes?: string[]
}

export type InstructorDoorQrBundle = {
  slug: string
  publicUrl: string
  instructorName: string
  defaultOfficeLocation: string
  publicNote: string
  instructorContact: OfficeHoursInstructorContact
  academicTermId: number | null
  academicTermLabel: string | null
  universityId: number | null
  courses: DoorQrCourseHours[]
}

export type PublicOfficeHoursPage = {
  slug: string
  instructorName: string
  defaultOfficeLocation: string
  publicNote: string
  instructorContact: OfficeHoursInstructorContact
  terms: { id: number; label: string; isActive: boolean }[]
  selectedTermId: number | null
  courses: DoorQrCourseHours[]
}

type StoredPublicProfile = {
  slug: string
  defaultOfficeLocation: string
  publicNote: string
  instructorContact: OfficeHoursInstructorContact
}

function generateSlug(length = 10): string {
  const bytes = randomBytes(length)
  let out = ""
  for (let i = 0; i < length; i++) {
    out += SLUG_CHARS[bytes[i]! % SLUG_CHARS.length]
  }
  return out
}

function formatTimeValue(raw: unknown): string {
  if (typeof raw === "string") return raw.slice(0, 5)
  return String(raw ?? "").slice(0, 5)
}

function mapSlotRows(rows: unknown[]): OfficeHourSlot[] {
  return (rows as { day_of_week: number; start_time: unknown; end_time: unknown }[]).map((r) => ({
    dayOfWeek: r.day_of_week,
    dayName: DAY_NAMES[r.day_of_week] ?? "Day",
    startTime: formatTimeValue(r.start_time),
    endTime: formatTimeValue(r.end_time),
  }))
}

export function buildOfficeHoursPublicUrl(slug: string, origin?: string | null): string {
  const base = getBaseUrl(origin)
  return `${base}/office-hours/${encodeURIComponent(slug)}`
}

export function buildPermanentOfficeHoursPublicUrl(slug: string): string {
  return `${getPermanentPublicBaseUrl()}/office-hours/${encodeURIComponent(slug)}`
}

export async function ensureOfficeHoursPublicProfileSchema(): Promise<void> {
  await ensureOfficeHoursCourseScopeColumns()

  await sql`
    CREATE TABLE IF NOT EXISTS instructor_office_hour_public_profiles (
      id SERIAL PRIMARY KEY,
      instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
      public_slug VARCHAR(32) NOT NULL,
      default_office_location TEXT,
      public_note TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (instructor_id),
      UNIQUE (public_slug)
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_office_hour_public_profiles_slug
    ON instructor_office_hour_public_profiles(public_slug)
  `
  await sql`ALTER TABLE instructor_office_hour_public_profiles ADD COLUMN IF NOT EXISTS contact_email TEXT`
  await sql`ALTER TABLE instructor_office_hour_public_profiles ADD COLUMN IF NOT EXISTS contact_phone TEXT`
  await sql`ALTER TABLE instructor_office_hour_public_profiles ADD COLUMN IF NOT EXISTS department TEXT`
  await sql`ALTER TABLE instructor_office_hour_public_profiles ADD COLUMN IF NOT EXISTS office_building TEXT`
  await sql`ALTER TABLE instructor_office_hour_public_profiles ADD COLUMN IF NOT EXISTS office_room TEXT`
  await sql`ALTER TABLE instructor_office_hour_public_profiles ADD COLUMN IF NOT EXISTS on_demand_support TEXT`
  await sql`ALTER TABLE instructor_office_hour_public_profiles ADD COLUMN IF NOT EXISTS additional_meeting_hours TEXT`

  await sql`
    ALTER TABLE regular_office_hours
    ADD COLUMN IF NOT EXISTS academic_term_id INTEGER REFERENCES academic_terms(id) ON DELETE CASCADE
  `
  await sql`
    ALTER TABLE regular_office_hours
    ADD COLUMN IF NOT EXISTS office_location TEXT
  `
  await sql`
    ALTER TABLE regular_office_hours
    ADD COLUMN IF NOT EXISTS instructor_id INTEGER REFERENCES instructors(id) ON DELETE CASCADE
  `
  await sql`
    ALTER TABLE regular_office_hours
    ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_regular_office_hours_term_instructor
    ON regular_office_hours(academic_term_id, instructor_id, course_id, session_id)
  `
}

async function generateUniqueSlug(maxAttempts = 12): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const slug = generateSlug()
    const existing = await sql`
      SELECT 1 FROM instructor_office_hour_public_profiles
      WHERE public_slug = ${slug}
      LIMIT 1
    `
    if (existing.length === 0) return slug
  }
  throw new Error("Unable to generate unique office hours slug")
}

export async function getOrCreateOfficeHoursPublicProfile(ownerInstructorId: number): Promise<StoredPublicProfile> {
  await ensureOfficeHoursPublicProfileSchema()

  const existing = await sql`
    SELECT
      public_slug,
      default_office_location,
      public_note,
      contact_email,
      contact_phone,
      department,
      office_building,
      office_room,
      on_demand_support,
      additional_meeting_hours
    FROM instructor_office_hour_public_profiles
    WHERE instructor_id = ${ownerInstructorId}
    LIMIT 1
  `
  if (existing.length > 0) {
    const row = existing[0] as {
      public_slug: string
      default_office_location: string | null
      public_note: string | null
      contact_email: string | null
      contact_phone: string | null
      department: string | null
      office_building: string | null
      office_room: string | null
      on_demand_support: string | null
      additional_meeting_hours: string | null
    }
    return profileRowToStored(row)
  }

  const slug = await generateUniqueSlug()
  await sql`
    INSERT INTO instructor_office_hour_public_profiles (instructor_id, public_slug)
    VALUES (${ownerInstructorId}, ${slug})
  `
  return {
    slug,
    defaultOfficeLocation: "",
    publicNote: "",
    instructorContact: emptyInstructorContact(),
  }
}

function emptyInstructorContact(): OfficeHoursInstructorContact {
  return {
    email: null,
    phone: null,
    department: null,
    officeBuilding: null,
    officeRoom: null,
    officeLocation: null,
    onDemandSupport: null,
    additionalMeetingHours: null,
  }
}

function profileRowToStored(row: {
  public_slug: string
  default_office_location: string | null
  public_note: string | null
  contact_email: string | null
  contact_phone: string | null
  department: string | null
  office_building: string | null
  office_room: string | null
  on_demand_support: string | null
  additional_meeting_hours: string | null
}): StoredPublicProfile {
  return {
    slug: row.public_slug,
    defaultOfficeLocation: row.default_office_location ?? "",
    publicNote: row.public_note ?? "",
    instructorContact: {
      email: row.contact_email,
      phone: row.contact_phone,
      department: row.department,
      officeBuilding: row.office_building,
      officeRoom: row.office_room,
      officeLocation: row.default_office_location,
      onDemandSupport: row.on_demand_support,
      additionalMeetingHours: row.additional_meeting_hours,
    },
  }
}

async function loadInstructorAccountContact(instructorId: number): Promise<Partial<OfficeHoursInstructorContact>> {
  const rows = await sql`
    SELECT email, phone, office, institution, job_title
    FROM instructors
    WHERE id = ${instructorId}
    LIMIT 1
  `
  if (rows.length === 0) return {}
  const row = rows[0] as {
    email: string | null
    phone: string | null
    office: string | null
    institution: string | null
    job_title: string | null
  }
  return {
    email: row.email?.trim() || null,
    phone: row.phone?.trim() || null,
    officeLocation: row.office?.trim() || null,
    department: row.job_title?.trim() || row.institution?.trim() || null,
  }
}

async function resolveInstructorContact(
  ownerId: number,
  profile: StoredPublicProfile,
  termOfferings: FacultyCourseOffering[],
): Promise<OfficeHoursInstructorContact> {
  let contact: OfficeHoursInstructorContact = {
    ...emptyInstructorContact(),
    ...profile.instructorContact,
    officeLocation: profile.defaultOfficeLocation || profile.instructorContact.officeLocation,
  }

  for (const offering of termOfferings) {
    const fields = await getPublishedSyllabusInstructorFields(offering.course_id, offering.session_id ?? null)
    contact = mergeSyllabusContact(contact, contactFromSyllabusFields(fields))
  }

  const account = await loadInstructorAccountContact(ownerId)
  contact = mergeSyllabusContact(contact, {
    email: account.email ?? null,
    phone: account.phone ?? null,
    department: account.department ?? null,
    officeBuilding: null,
    officeRoom: null,
    officeLocation: account.officeLocation ?? null,
    onDemandSupport: null,
    additionalMeetingHours: null,
  })

  if (!contact.officeLocation && (contact.officeBuilding || contact.officeRoom)) {
    contact.officeLocation = [contact.officeBuilding, contact.officeRoom].filter(Boolean).join(" ").trim() || null
  }

  return contact
}

async function enrichOfferingsWithSyllabusHours(rows: DoorQrCourseHours[]): Promise<DoorQrCourseHours[]> {
  return Promise.all(
    rows.map(async (row) => {
      if (row.slots.length > 0) {
        return { ...row, hoursSource: "door" as const }
      }

      const syllabus = await loadSyllabusOfficeHoursForOffering(row.courseId, row.sessionId)
      const slots = syllabus.slots
      return {
        ...row,
        slots,
        hoursSource: slots.length > 0 ? ("syllabus" as const) : ("none" as const),
        syllabusHoursSummary: syllabus.syllabusHoursSummary,
        supplementaryNotes: syllabus.supplementaryNotes,
        officeLocation: row.officeLocation ?? syllabus.officeLocation,
      }
    }),
  )
}

async function loadInstructorDisplayName(instructorId: number): Promise<string> {
  const rows = await sql`
    SELECT name, username FROM instructors WHERE id = ${instructorId} LIMIT 1
  `
  if (rows.length === 0) return "Instructor"
  const row = rows[0] as { name: string | null; username: string | null }
  return String(row.name ?? row.username ?? "Instructor").trim() || "Instructor"
}

async function loadTermLabel(termId: number): Promise<string | null> {
  const rows = await sql`
    SELECT year, term FROM academic_terms WHERE id = ${termId} LIMIT 1
  `
  if (rows.length === 0) return null
  const row = rows[0] as { year: number; term: string }
  return formatAcademicTermLabel(Number(row.year), String(row.term))
}

function hoursScopeKey(courseId: number, sessionId: number | null): string {
  return `${courseId}:${sessionId ?? 0}`
}

function buildOfferingRows(
  termOfferings: FacultyCourseOffering[],
  defaultOfficeLocation: string,
): DoorQrCourseHours[] {
  return termOfferings
    .slice()
    .sort((a, b) => {
      const codeCmp = facultyOfferingChipCode(a).localeCompare(facultyOfferingChipCode(b))
      if (codeCmp !== 0) return codeCmp
      return (a.session_code ?? "").localeCompare(b.session_code ?? "")
    })
    .map((o) => ({
    courseId: o.course_id,
    sessionId: o.session_id ?? null,
    offeringKey: facultyOfferingKey(o.course_id, o.academic_term_id, o.session_id),
    courseCode: facultyOfferingChipCode(o),
    courseTitle: o.course_title,
    sessionCode: o.session_code ?? null,
    officeLocation: defaultOfficeLocation || null,
    slots: [],
  }))
}

async function loadHoursForOfferings(
  ownerInstructorId: number,
  academicTermId: number,
  offerings: Pick<DoorQrCourseHours, "courseId" | "sessionId" | "offeringKey">[],
  defaultOfficeLocation: string,
): Promise<Map<string, Pick<DoorQrCourseHours, "officeLocation" | "slots">>> {
  const result = new Map<string, Pick<DoorQrCourseHours, "officeLocation" | "slots">>()
  if (offerings.length === 0) return result

  const courseIds = [...new Set(offerings.map((o) => o.courseId))]
  const hourRows = await sql`
    SELECT course_id, session_id, day_of_week, start_time, end_time, office_location
    FROM regular_office_hours
    WHERE instructor_id = ${ownerInstructorId}
      AND academic_term_id = ${academicTermId}
      AND course_id = ANY(${courseIds}::int[])
    ORDER BY course_id, session_id NULLS FIRST, day_of_week, start_time
  `

  const byScope = new Map<string, { slots: OfficeHourSlot[]; location?: string }>()
  for (const row of hourRows as {
    course_id: number
    session_id: number | null
    day_of_week: number
    start_time: unknown
    end_time: unknown
    office_location: string | null
  }[]) {
    const sessionId = row.session_id != null ? Number(row.session_id) : null
    const key = hoursScopeKey(Number(row.course_id), sessionId)
    const bucket = byScope.get(key) ?? { slots: [] }
    bucket.slots.push({
      dayOfWeek: row.day_of_week,
      dayName: DAY_NAMES[row.day_of_week] ?? "Day",
      startTime: formatTimeValue(row.start_time),
      endTime: formatTimeValue(row.end_time),
    })
    if (row.office_location?.trim()) {
      bucket.location = row.office_location.trim()
    }
    byScope.set(key, bucket)
  }

  for (const offering of offerings) {
    const specific = byScope.get(hoursScopeKey(offering.courseId, offering.sessionId))
    const courseWide =
      offering.sessionId != null ? byScope.get(hoursScopeKey(offering.courseId, null)) : undefined
    const merged = specific ?? courseWide
    result.set(offering.offeringKey, {
      officeLocation: merged?.location ?? (defaultOfficeLocation || null),
      slots: merged?.slots ?? [],
    })
  }

  return result
}

function applyHoursToOfferings(
  rows: DoorQrCourseHours[],
  hoursMap: Map<string, Pick<DoorQrCourseHours, "officeLocation" | "slots">>,
): DoorQrCourseHours[] {
  return rows.map((row) => {
    const loaded = hoursMap.get(row.offeringKey)
    if (!loaded) return row
    return { ...row, officeLocation: loaded.officeLocation, slots: loaded.slots }
  })
}

export async function fetchInstructorDoorQrBundle(
  actorId: number,
  universityId: number | null,
  academicTermId: number | null,
): Promise<InstructorDoorQrBundle | null> {
  await ensureOfficeHoursPublicProfileSchema()
  const actor = await loadInstructorActor(actorId)
  if (!actor) return null
  const ownerId = courseOwnerIdForActor(actor)

  const profile = await getOrCreateOfficeHoursPublicProfile(ownerId)
  const instructorName = await loadInstructorDisplayName(ownerId)

  const offerings = await listFacultyCourseOfferings(actorId, universityId)
  const termIds = [...new Set(offerings.map((o) => o.academic_term_id).filter((id): id is number => id != null))]
  let resolvedTermId = academicTermId
  if (resolvedTermId == null || !termIds.includes(resolvedTermId)) {
    const active = await getActiveAcademicTerm()
    if (active && termIds.includes(active.id)) {
      resolvedTermId = active.id
    } else {
      resolvedTermId = termIds[0] ?? null
    }
  }

  const termOfferings = resolvedTermId != null
    ? offerings.filter((o) => o.academic_term_id === resolvedTermId)
    : offerings

  const coursesMeta = buildOfferingRows(termOfferings, profile.defaultOfficeLocation)
  const hoursMap =
    resolvedTermId != null
      ? await loadHoursForOfferings(ownerId, resolvedTermId, coursesMeta, profile.defaultOfficeLocation)
      : new Map<string, Pick<DoorQrCourseHours, "officeLocation" | "slots">>()
  const courses = await enrichOfferingsWithSyllabusHours(applyHoursToOfferings(coursesMeta, hoursMap))
  const instructorContact = await resolveInstructorContact(ownerId, profile, termOfferings)

  return {
    slug: profile.slug,
    publicUrl: buildPermanentOfficeHoursPublicUrl(profile.slug),
    instructorName,
    defaultOfficeLocation: profile.defaultOfficeLocation,
    publicNote: profile.publicNote,
    instructorContact,
    academicTermId: resolvedTermId,
    academicTermLabel: resolvedTermId != null ? await loadTermLabel(resolvedTermId) : null,
    universityId,
    courses,
  }
}

export async function saveInstructorDoorQrBundle(
  actorId: number,
  payload: {
    universityId: number | null
    academicTermId: number
    defaultOfficeLocation?: string
    publicNote?: string
    instructorContact?: Partial<OfficeHoursInstructorContact>
    courses: {
      courseId: number
      sessionId?: number | null
      offeringKey?: string
      officeLocation?: string | null
      slots: { dayOfWeek: number; startTime: string; endTime: string }[]
    }[]
  },
): Promise<InstructorDoorQrBundle | null> {
  await ensureOfficeHoursPublicProfileSchema()
  const actor = await loadInstructorActor(actorId)
  if (!actor) return null
  const ownerId = courseOwnerIdForActor(actor)

  const offerings = await listFacultyCourseOfferings(actorId, payload.universityId)
  const allowedOfferings = new Map(
    offerings
      .filter((o) => o.academic_term_id === payload.academicTermId)
      .map((o) => [facultyOfferingKey(o.course_id, o.academic_term_id, o.session_id), o]),
  )

  const defaultOfficeLocation = String(payload.defaultOfficeLocation ?? "").trim()
  const publicNote = String(payload.publicNote ?? "").trim()
  const contact = payload.instructorContact ?? {}

  await getOrCreateOfficeHoursPublicProfile(ownerId)
  await sql`
    UPDATE instructor_office_hour_public_profiles
    SET
      default_office_location = ${defaultOfficeLocation || null},
      public_note = ${publicNote || null},
      contact_email = ${String(contact.email ?? "").trim() || null},
      contact_phone = ${String(contact.phone ?? "").trim() || null},
      department = ${String(contact.department ?? "").trim() || null},
      office_building = ${String(contact.officeBuilding ?? "").trim() || null},
      office_room = ${String(contact.officeRoom ?? "").trim() || null},
      on_demand_support = ${String(contact.onDemandSupport ?? "").trim() || null},
      additional_meeting_hours = ${String(contact.additionalMeetingHours ?? "").trim() || null},
      updated_at = NOW()
    WHERE instructor_id = ${ownerId}
  `

  for (const course of payload.courses) {
    const courseId = Math.trunc(Number(course.courseId))
    const sessionIdRaw = course.sessionId
    const sessionId =
      sessionIdRaw != null && Number.isFinite(Number(sessionIdRaw)) && Number(sessionIdRaw) > 0
        ? Math.trunc(Number(sessionIdRaw))
        : null
    const offeringKey =
      course.offeringKey ??
      facultyOfferingKey(courseId, payload.academicTermId, sessionId)
    if (!Number.isFinite(courseId) || !allowedOfferings.has(offeringKey)) continue

    if (sessionId != null) {
      await sql`
        DELETE FROM regular_office_hours
        WHERE instructor_id = ${ownerId}
          AND academic_term_id = ${payload.academicTermId}
          AND course_id = ${courseId}
          AND session_id = ${sessionId}
      `
    } else {
      await sql`
        DELETE FROM regular_office_hours
        WHERE instructor_id = ${ownerId}
          AND academic_term_id = ${payload.academicTermId}
          AND course_id = ${courseId}
          AND session_id IS NULL
      `
    }

    const location = String(course.officeLocation ?? defaultOfficeLocation ?? "").trim() || null
    for (const slot of course.slots ?? []) {
      const day = Math.trunc(Number(slot.dayOfWeek))
      if (!Number.isFinite(day) || day < 0 || day > 6) continue
      if (!slot.startTime || !slot.endTime) continue
      await sql`
        INSERT INTO regular_office_hours (
          day_of_week, start_time, end_time, semester_label, course_id,
          academic_term_id, office_location, instructor_id, session_id, updated_at
        )
        VALUES (
          ${day}, ${slot.startTime}, ${slot.endTime}, 'current', ${courseId},
          ${payload.academicTermId}, ${location}, ${ownerId}, ${sessionId}, NOW()
        )
      `
    }
  }

  await touchCalendarFeed("faculty", ownerId)
  return fetchInstructorDoorQrBundle(actorId, payload.universityId, payload.academicTermId)
}

export async function fetchPublicOfficeHoursPage(
  slug: string,
  _universityId: number | null,
  academicTermId: number | null,
): Promise<PublicOfficeHoursPage | null> {
  await ensureOfficeHoursPublicProfileSchema()

  const profileRows = await sql`
    SELECT
      p.instructor_id,
      p.public_slug,
      p.default_office_location,
      p.public_note,
      p.contact_email,
      p.contact_phone,
      p.department,
      p.office_building,
      p.office_room,
      p.on_demand_support,
      p.additional_meeting_hours,
      i.name,
      i.username
    FROM instructor_office_hour_public_profiles p
    INNER JOIN instructors i ON i.id = p.instructor_id
    WHERE p.public_slug = ${slug}
    LIMIT 1
  `
  if (profileRows.length === 0) return null

  const profile = profileRows[0] as {
    instructor_id: number
    public_slug: string
    default_office_location: string | null
    public_note: string | null
    contact_email: string | null
    contact_phone: string | null
    department: string | null
    office_building: string | null
    office_room: string | null
    on_demand_support: string | null
    additional_meeting_hours: string | null
    name: string | null
    username: string | null
  }
  const ownerId = Number(profile.instructor_id)
  const instructorName = String(profile.name ?? profile.username ?? "Instructor").trim() || "Instructor"
  const storedProfile = profileRowToStored(profile)
  const defaultOfficeLocation = storedProfile.defaultOfficeLocation
  const publicNote = storedProfile.publicNote

  const allOfferings = await listFacultyCourseOfferings(ownerId, PVAMU_UNIVERSITY_ID)

  const termMap = new Map<number, { id: number; label: string; isActive: boolean }>()
  for (const o of allOfferings) {
    if (o.academic_term_id == null) continue
    if (!termMap.has(o.academic_term_id)) {
      termMap.set(o.academic_term_id, {
        id: o.academic_term_id,
        label: o.term_label ?? `Term ${o.academic_term_id}`,
        isActive: !!o.is_active_term,
      })
    }
  }

  const scopedOfferings = allOfferings

  const termIds = [...new Set(scopedOfferings.map((o) => o.academic_term_id).filter((id): id is number => id != null))]
  let selectedTermId = academicTermId
  if (selectedTermId == null || !termIds.includes(selectedTermId)) {
    const active = await getActiveAcademicTerm()
    if (active && termIds.includes(active.id)) selectedTermId = active.id
    else selectedTermId = termIds[0] ?? null
  }

  const terms = termIds
    .map((id) => termMap.get(id))
    .filter((t): t is { id: number; label: string; isActive: boolean } => t != null)
    .sort((a, b) => (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1))

  const termOfferings =
    selectedTermId != null
      ? scopedOfferings.filter((o) => o.academic_term_id === selectedTermId)
      : scopedOfferings

  const coursesMeta = buildOfferingRows(termOfferings, defaultOfficeLocation)
  const hoursMap =
    selectedTermId != null
      ? await loadHoursForOfferings(ownerId, selectedTermId, coursesMeta, defaultOfficeLocation)
      : new Map<string, Pick<DoorQrCourseHours, "officeLocation" | "slots">>()
  const courses = await enrichOfferingsWithSyllabusHours(applyHoursToOfferings(coursesMeta, hoursMap))
  const instructorContact = await resolveInstructorContact(ownerId, storedProfile, termOfferings)

  return {
    slug,
    instructorName,
    defaultOfficeLocation,
    publicNote,
    instructorContact,
    terms,
    selectedTermId,
    courses,
  }
}
