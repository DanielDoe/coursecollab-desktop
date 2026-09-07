import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import { createInstructorCourseNote } from "@/lib/cora/services/create-course-note"
import { createInstructorGroup } from "@/lib/cora/services/create-instructor-group"
import { createInstructorProject } from "@/lib/cora/services/create-instructor-project"
import { createInstructorAttendanceSession } from "@/lib/cora/services/create-attendance-session"
import {
  facultyModerateDiscussion,
  facultyReplyToDiscussion,
} from "@/lib/cora/services/discussion-faculty-actions"
import { createPlaygroundClassroomSession } from "@/lib/cora/services/create-playground-session"
import { publishCourseAssessment } from "@/lib/cora/services/publish-assessment"
import {
  approveClassroomPoint,
  awardClassroomPoints,
  createClassroomPointsAssignment,
} from "@/lib/cora/services/classroom-points-actions"
import {
  createOfficeHourMeetingRequest,
  manageRegularOfficeHours,
  updateOfficeHourRequest,
  type RegularOfficeHourSlot,
} from "@/lib/cora/services/office-hours-faculty-actions"
import {
  editProgressReviewContent,
  generateProgressReviewDraft,
  parseProgressReviewStudentIds,
  publishProgressReviews,
  saveProgressReviewForStudents,
} from "@/lib/cora/services/progress-review-actions"
import { saveRecommendationDraftLetter } from "@/lib/cora/services/recommendation-draft"
import {
  parseAttendancePolicyPatch,
  parseGradingPolicyPatch,
  updateCourseAttendancePolicy,
  updateCourseGradingPolicy,
} from "@/lib/cora/services/update-course-policies"
import { generateFlashcardsFromQuestionBank } from "@/lib/flashcard-bank-generate"
import { fetchFlashcardDeckById } from "@/lib/flashcards"
import { sql } from "@/lib/db"
import { EXTENDED_FACULTY_CAPABILITY_HANDLERS } from "@/lib/cora/services/faculty-capability-writes-extended"
import type { ConfirmCoraActionResult } from "@/lib/cora/confirmations/confirm-action"
import {
  registerCapabilityHandlers,
  type CapabilityHandler,
} from "@/lib/cora/services/capability-handler-registry"

export type FacultyCapabilityHandlerContext = {
  instructorId: number
  courseId: number
  courseCode?: string | null
  args: Record<string, unknown>
  capabilityId: string
}

export type FacultyHandlerResult = Omit<ConfirmCoraActionResult, "tool">

function invalid(message: string): FacultyHandlerResult {
  return { success: false, message, error: "invalid" }
}

function scope(): FacultyHandlerResult {
  return { success: false, message: "You do not have access to this course.", error: "scope" }
}

function success(
  message: string,
  entity: { type: string; id: number | string; title?: string; route?: string },
  extra?: Partial<FacultyHandlerResult>,
): FacultyHandlerResult {
  return { success: true, message, entity, ...extra }
}

async function withCourseAccess(
  ctx: FacultyCapabilityHandlerContext,
  run: () => Promise<FacultyHandlerResult>,
): Promise<FacultyHandlerResult> {
  const allowed = await instructorCanAccessCourse(ctx.instructorId, ctx.courseId)
  if (!allowed) return scope()
  return run()
}

function asTrimmed(value: unknown): string {
  return String(value ?? "").trim()
}

export const CORE_FACULTY_CAPABILITY_HANDLERS: Record<
  string,
  (ctx: FacultyCapabilityHandlerContext) => Promise<FacultyHandlerResult>
> = {
  "courseNote.create": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const title = asTrimmed(ctx.args.title) || "Course note"
      const bodyText = asTrimmed(ctx.args.bodyText ?? ctx.args.content)
      if (!bodyText) return invalid("Note body is required.")
      const created = await createInstructorCourseNote({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        title,
        bodyText,
        topic: ctx.args.topic != null ? String(ctx.args.topic) : null,
        session: ctx.args.session != null ? String(ctx.args.session) : null,
        isPublished: ctx.args.isPublished === true,
      })
      return success(`Created course note "${created.title}".`, {
        type: "note",
        id: created.noteId,
        title: created.title,
        route: created.href,
      })
    }),

  "flashcard.generateFromBank": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const topicName = asTrimmed(ctx.args.topicName ?? ctx.args.topic)
      if (!topicName) return invalid("Topic is required.")
      let courseCode = asTrimmed(ctx.courseCode)
      if (!courseCode) {
        const rows = (await sql`
          SELECT course_code FROM courses WHERE id = ${ctx.courseId} LIMIT 1
        `) as { course_code: string | null }[]
        courseCode = asTrimmed(rows[0]?.course_code)
      }
      if (!courseCode) return invalid("Course code required.")
      const generated = await generateFlashcardsFromQuestionBank({
        courseId: ctx.courseId,
        instructorId: ctx.instructorId,
        courseCode,
        topicName,
        session: ctx.args.session != null ? String(ctx.args.session) : null,
        deckId: ctx.args.deckId != null ? Number(ctx.args.deckId) : null,
        maxCards: ctx.args.maxCards != null ? Number(ctx.args.maxCards) : undefined,
      })
      const deck = await fetchFlashcardDeckById(generated.deckId)
      return success(
        `Created flashcard deck "${deck?.title ?? topicName}" with ${generated.cardsAdded} card${generated.cardsAdded === 1 ? "" : "s"}.`,
        {
          type: "flashcard_deck",
          id: generated.deckId,
          title: deck?.title ?? topicName,
          route: "/module/flashcards",
        },
        {
          undo: {
            method: "delete",
            entityType: "flashcard_deck",
            entityId: generated.deckId,
          },
        },
      )
    }),

  "group.create": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const name = asTrimmed(ctx.args.name ?? ctx.args.title)
      if (!name) return invalid("Group name is required.")
      const created = await createInstructorGroup({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        name,
        description: ctx.args.description != null ? String(ctx.args.description) : null,
        maxMembers:
          ctx.args.maxMembers != null
            ? Number(ctx.args.maxMembers)
            : ctx.args.max_members != null
              ? Number(ctx.args.max_members)
              : null,
        sessionCode:
          ctx.args.sessionCode != null
            ? String(ctx.args.sessionCode)
            : ctx.args.session_code != null
              ? String(ctx.args.session_code)
              : ctx.args.session != null
                ? String(ctx.args.session)
                : null,
      })
      return success(`Created group "${created.name}".`, {
        type: "group",
        id: created.groupId,
        title: created.name,
        route: created.href,
      })
    }),

  "project.create": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const title = asTrimmed(ctx.args.title)
      const groupId = Number(ctx.args.groupId ?? ctx.args.group_id)
      if (!title) return invalid("Project title is required.")
      if (!Number.isFinite(groupId) || groupId <= 0) {
        return invalid("groupId is required — projects attach to an approved group.")
      }
      const created = await createInstructorProject({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        groupId,
        title,
        summary: ctx.args.summary != null ? String(ctx.args.summary) : null,
        deliverables: ctx.args.deliverables != null ? String(ctx.args.deliverables) : null,
        targetPlatform:
          ctx.args.targetPlatform != null
            ? String(ctx.args.targetPlatform)
            : ctx.args.target_platform != null
              ? String(ctx.args.target_platform)
              : null,
      })
      return success(`Created project "${created.title}".`, {
        type: "project",
        id: created.projectId,
        title: created.title,
        route: created.href,
      })
    }),

  "attendance.createSession": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const section = asTrimmed(ctx.args.section ?? ctx.args.sectionCode)
      const classTitle = asTrimmed(
        ctx.args.classTitle ?? ctx.args.class_title ?? ctx.args.title ?? "Class",
      )
      const startTime = asTrimmed(ctx.args.startTime ?? ctx.args.start_time)
      const endTime = asTrimmed(ctx.args.endTime ?? ctx.args.end_time)
      if (!section || !startTime || !endTime) {
        return invalid("section, startTime, and endTime are required (ISO timestamps).")
      }
      const created = await createInstructorAttendanceSession({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        section,
        classTitle,
        startTime,
        endTime,
        requireLocation: ctx.args.requireLocation === true || ctx.args.require_location === true,
        locationLat:
          ctx.args.locationLat != null
            ? Number(ctx.args.locationLat)
            : ctx.args.location_lat != null
              ? Number(ctx.args.location_lat)
              : null,
        locationLong:
          ctx.args.locationLong != null
            ? Number(ctx.args.locationLong)
            : ctx.args.location_long != null
              ? Number(ctx.args.location_long)
              : null,
        radiusMeters: ctx.args.radiusMeters != null ? Number(ctx.args.radiusMeters) : undefined,
        qrExpiryMinutes:
          ctx.args.qrExpiryMinutes != null ? Number(ctx.args.qrExpiryMinutes) : undefined,
      })
      return success(`Attendance session "${created.classTitle}" is live.`, {
        type: "attendance_session",
        id: created.sessionId,
        title: created.classTitle,
        route: created.href,
      })
    }),

  "discussion.create": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const threadId = Number(ctx.args.threadId ?? ctx.args.thread_id)
      const replyText = asTrimmed(ctx.args.replyText ?? ctx.args.reply_text ?? ctx.args.content)
      if (!Number.isFinite(threadId) || threadId <= 0 || !replyText) {
        return invalid(
          "discussion.create requires thread_id and reply_text (faculty reply to a student thread).",
        )
      }
      const created = await facultyReplyToDiscussion({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        threadId,
        replyText,
      })
      return success("Faculty reply posted to the discussion.", {
        type: "discussion",
        id: created.replyId,
        title: `Thread ${created.threadId}`,
        route: created.href,
      })
    }),

  "discussion.moderate": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const threadId = Number(ctx.args.threadId ?? ctx.args.thread_id)
      if (!Number.isFinite(threadId) || threadId <= 0) return invalid("thread_id is required.")
      const result = await facultyModerateDiscussion({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        threadId,
        isPinned:
          ctx.args.isPinned === true || ctx.args.is_pinned === true
            ? true
            : ctx.args.isPinned === false || ctx.args.is_pinned === false
              ? false
              : undefined,
        isResolved:
          ctx.args.isResolved === true || ctx.args.is_resolved === true
            ? true
            : ctx.args.isResolved === false || ctx.args.is_resolved === false
              ? false
              : undefined,
      })
      return success("Discussion updated.", {
        type: "discussion",
        id: result.threadId,
        title: `Thread ${result.threadId}`,
        route: result.href,
      })
    }),

  "discussion.pin": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const threadId = Number(ctx.args.threadId ?? ctx.args.thread_id)
      if (!Number.isFinite(threadId) || threadId <= 0) return invalid("thread_id is required.")
      const result = await facultyModerateDiscussion({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        threadId,
        isPinned: ctx.args.isPinned !== false && ctx.args.is_pinned !== false,
      })
      return success("Discussion updated.", {
        type: "discussion",
        id: result.threadId,
        title: `Thread ${result.threadId}`,
        route: result.href,
      })
    }),

  "discussion.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const threadId = Number(ctx.args.threadId ?? ctx.args.thread_id)
      if (!Number.isFinite(threadId) || threadId <= 0) return invalid("thread_id is required.")
      const result = await facultyModerateDiscussion({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        threadId,
        isPinned:
          ctx.args.isPinned === true || ctx.args.is_pinned === true
            ? true
            : ctx.args.isPinned === false || ctx.args.is_pinned === false
              ? false
              : undefined,
        isResolved:
          ctx.args.isResolved === true || ctx.args.is_resolved === true
            ? true
            : ctx.args.isResolved === false || ctx.args.is_resolved === false
              ? false
              : undefined,
      })
      return success("Discussion updated.", {
        type: "discussion",
        id: result.threadId,
        title: `Thread ${result.threadId}`,
        route: result.href,
      })
    }),

  "playground.createSession": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const topics = Array.isArray(ctx.args.topics)
        ? ctx.args.topics.map((t) => String(t))
        : ctx.args.topic != null
          ? [String(ctx.args.topic)]
          : []
      const created = await createPlaygroundClassroomSession({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        courseCode: ctx.courseCode ?? null,
        topics,
        questionCount:
          ctx.args.questionCount != null
            ? Number(ctx.args.questionCount)
            : ctx.args.question_count != null
              ? Number(ctx.args.question_count)
              : undefined,
        durationSec:
          ctx.args.durationSec != null
            ? Number(ctx.args.durationSec)
            : ctx.args.duration_sec != null
              ? Number(ctx.args.duration_sec)
              : undefined,
        allowedSessionIds: Array.isArray(ctx.args.allowedSessionIds)
          ? ctx.args.allowedSessionIds
              .map((id) => Number(id))
              .filter((id) => Number.isFinite(id))
          : Array.isArray(ctx.args.allowed_sessions)
            ? ctx.args.allowed_sessions
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id))
            : null,
      })
      return success(
        `Playground lobby opened${created.joinPasscode ? ` · passcode ${created.joinPasscode}` : ""}.`,
        {
          type: "playground_session",
          id: created.sessionId,
          title: created.sessionCode ?? "Playground session",
          route: created.href,
        },
        { data: { joinPasscode: created.joinPasscode, sessionCode: created.sessionCode } },
      )
    }),

  "assessment.publish": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const quizId = Number(
        ctx.args.quizId ?? ctx.args.quiz_id ?? ctx.args.assessmentId ?? ctx.args.assessment_id,
      )
      if (!Number.isFinite(quizId) || quizId <= 0) return invalid("quizId is required.")
      const published = await publishCourseAssessment({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        quizId,
      })
      return success(`Published assessment "${published.title}".`, {
        type: "assessment",
        id: published.quizId,
        title: published.title,
        route: published.href,
      })
    }),

  "points.createAssignment": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const title = asTrimmed(ctx.args.title)
      if (!title) return invalid("Assignment title is required.")
      const created = await createClassroomPointsAssignment({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        title,
        description: ctx.args.description != null ? String(ctx.args.description) : null,
        session:
          ctx.args.session != null
            ? String(ctx.args.session)
            : ctx.args.section != null
              ? String(ctx.args.section)
              : null,
        durationHours:
          ctx.args.durationHours != null
            ? Number(ctx.args.durationHours)
            : ctx.args.duration_hours != null
              ? Number(ctx.args.duration_hours)
              : null,
        dueAt:
          ctx.args.dueAt != null
            ? String(ctx.args.dueAt)
            : ctx.args.due_at != null
              ? String(ctx.args.due_at)
              : null,
        submissionKind:
          ctx.args.submissionKind != null
            ? String(ctx.args.submissionKind)
            : ctx.args.submission_kind != null
              ? String(ctx.args.submission_kind)
              : null,
      })
      return success(`Created classroom assignment "${created.title}".`, {
        type: "announcement",
        id: created.submissionId,
        title: created.title,
        route: created.href,
      })
    }),

  "points.approve": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const pointId = Number(ctx.args.pointId ?? ctx.args.point_id ?? ctx.args.id)
      if (!Number.isFinite(pointId) || pointId <= 0) return invalid("pointId is required.")
      const approved = await approveClassroomPoint({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        pointId,
        points: ctx.args.points != null ? Number(ctx.args.points) : null,
      })
      return success(`Approved classroom point #${approved.pointId} (${approved.points} pts).`, {
        type: "announcement",
        id: approved.pointId,
        title: `${approved.points} points approved`,
        route: approved.href,
      })
    }),

  "points.award": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const studentId = Number(ctx.args.studentId ?? ctx.args.student_id)
      const points = Number(ctx.args.points)
      const reason = asTrimmed(ctx.args.reason)
      if (!Number.isFinite(studentId) || studentId <= 0 || !reason) {
        return invalid("studentId, points, and reason are required.")
      }
      const awarded = await awardClassroomPoints({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        studentId,
        points,
        reason,
        category: ctx.args.category != null ? String(ctx.args.category) : null,
        session:
          ctx.args.session != null
            ? String(ctx.args.session)
            : ctx.args.section != null
              ? String(ctx.args.section)
              : null,
      })
      return success(`Awarded ${awarded.points} classroom points.`, {
        type: "announcement",
        id: awarded.awardId,
        title: `${awarded.points} points awarded`,
        route: awarded.href,
      })
    }),

  "officeHours.createMeeting": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const studentId = Number(ctx.args.studentId ?? ctx.args.student_id)
      const topic = asTrimmed(ctx.args.topic)
      if (!Number.isFinite(studentId) || studentId <= 0 || !topic) {
        return invalid("studentId and topic are required.")
      }
      const created = await createOfficeHourMeetingRequest({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        studentId,
        topic,
        areaOfConcern:
          ctx.args.areaOfConcern != null
            ? String(ctx.args.areaOfConcern)
            : ctx.args.area_of_concern != null
              ? String(ctx.args.area_of_concern)
              : null,
        description: ctx.args.description != null ? String(ctx.args.description) : null,
        priority: ctx.args.priority != null ? String(ctx.args.priority) : null,
        preferredDates: Array.isArray(ctx.args.preferredDates)
          ? ctx.args.preferredDates.map(String)
          : Array.isArray(ctx.args.preferred_dates)
            ? ctx.args.preferred_dates.map(String)
            : null,
      })
      return success(`Office hours request created for "${created.topic}".`, {
        type: "announcement",
        id: created.requestId,
        title: created.topic,
        route: created.href,
      })
    }),

  "officeHours.approve": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const requestId = Number(ctx.args.requestId ?? ctx.args.request_id ?? ctx.args.id)
      if (!Number.isFinite(requestId) || requestId <= 0) return invalid("requestId is required.")
      const updated = await updateOfficeHourRequest({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        requestId,
        status: String(ctx.args.status ?? "approved"),
        scheduledDate:
          ctx.args.scheduledDate != null
            ? String(ctx.args.scheduledDate)
            : ctx.args.scheduled_date != null
              ? String(ctx.args.scheduled_date)
              : null,
        meetingLink:
          ctx.args.meetingLink != null
            ? String(ctx.args.meetingLink)
            : ctx.args.meeting_link != null
              ? String(ctx.args.meeting_link)
              : null,
        meetingVenue:
          ctx.args.meetingVenue != null
            ? String(ctx.args.meetingVenue)
            : ctx.args.meeting_venue != null
              ? String(ctx.args.meeting_venue)
              : null,
        instructorNotes:
          ctx.args.instructorNotes != null
            ? String(ctx.args.instructorNotes)
            : ctx.args.instructor_notes != null
              ? String(ctx.args.instructor_notes)
              : null,
      })
      return success(`Office hours request #${updated.requestId} marked ${updated.status}.`, {
        type: "announcement",
        id: updated.requestId,
        title: `Office hours ${updated.status}`,
        route: updated.href,
      })
    }),

  "officeHours.decline": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const requestId = Number(ctx.args.requestId ?? ctx.args.request_id ?? ctx.args.id)
      if (!Number.isFinite(requestId) || requestId <= 0) return invalid("requestId is required.")
      const updated = await updateOfficeHourRequest({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        requestId,
        status: String(ctx.args.status ?? "declined"),
        scheduledDate:
          ctx.args.scheduledDate != null
            ? String(ctx.args.scheduledDate)
            : ctx.args.scheduled_date != null
              ? String(ctx.args.scheduled_date)
              : null,
        meetingLink:
          ctx.args.meetingLink != null
            ? String(ctx.args.meetingLink)
            : ctx.args.meeting_link != null
              ? String(ctx.args.meeting_link)
              : null,
        meetingVenue:
          ctx.args.meetingVenue != null
            ? String(ctx.args.meetingVenue)
            : ctx.args.meeting_venue != null
              ? String(ctx.args.meeting_venue)
              : null,
        instructorNotes:
          ctx.args.instructorNotes != null
            ? String(ctx.args.instructorNotes)
            : ctx.args.instructor_notes != null
              ? String(ctx.args.instructor_notes)
              : null,
      })
      return success(`Office hours request #${updated.requestId} marked ${updated.status}.`, {
        type: "announcement",
        id: updated.requestId,
        title: `Office hours ${updated.status}`,
        route: updated.href,
      })
    }),

  "officeHours.manageAvailability": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const rawSlots = Array.isArray(ctx.args.slots) ? ctx.args.slots : []
      const slots: RegularOfficeHourSlot[] = rawSlots
        .map((slot) => {
          if (!slot || typeof slot !== "object") return null
          const s = slot as Record<string, unknown>
          return {
            dayOfWeek: Number(s.dayOfWeek ?? s.day_of_week),
            startTime: String(s.startTime ?? s.start_time ?? ""),
            endTime: String(s.endTime ?? s.end_time ?? ""),
          }
        })
        .filter((s): s is RegularOfficeHourSlot => s != null)
      const saved = await manageRegularOfficeHours({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        slots,
        semesterLabel:
          ctx.args.semesterLabel != null
            ? String(ctx.args.semesterLabel)
            : ctx.args.semester_label != null
              ? String(ctx.args.semester_label)
              : null,
      })
      return success(
        `Saved ${saved.slotCount} regular office hour slot${saved.slotCount === 1 ? "" : "s"}.`,
        {
          type: "calendar_events",
          id: ctx.courseId,
          title: "Regular office hours",
          route: saved.href,
        },
      )
    }),

  "progressReview.draft": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const studentIds = parseProgressReviewStudentIds(ctx.args)
      const draft = await generateProgressReviewDraft({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        studentIds: studentIds.length ? studentIds : null,
        reviewPeriod:
          ctx.args.reviewPeriod != null
            ? String(ctx.args.reviewPeriod)
            : ctx.args.review_period != null
              ? String(ctx.args.review_period)
              : null,
        asOfDate:
          ctx.args.asOfDate != null
            ? String(ctx.args.asOfDate)
            : ctx.args.as_of_date != null
              ? String(ctx.args.as_of_date)
              : null,
        onlyMissing: ctx.args.onlyMissing === true || ctx.args.only_missing === true,
      })
      return success(
        `Generated ${draft.generated} progress review draft${draft.generated === 1 ? "" : "s"} (saved, not delivered).`,
        {
          type: "announcement",
          id: draft.reviewIds[0] ?? ctx.courseId,
          title: "Progress review draft",
          route: draft.href,
        },
        { data: { generated: draft.generated, reviewIds: draft.reviewIds } },
      )
    }),

  "progressReview.save": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const studentIds = parseProgressReviewStudentIds(ctx.args)
      if (studentIds.length === 0) return invalid("studentId or studentIds is required.")
      const saved = await saveProgressReviewForStudents({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        studentIds,
        reviewPeriod:
          ctx.args.reviewPeriod != null
            ? String(ctx.args.reviewPeriod)
            : ctx.args.review_period != null
              ? String(ctx.args.review_period)
              : null,
        asOfDate:
          ctx.args.asOfDate != null
            ? String(ctx.args.asOfDate)
            : ctx.args.as_of_date != null
              ? String(ctx.args.as_of_date)
              : null,
      })
      return success(`Saved ${saved.saved} progress review${saved.saved === 1 ? "" : "s"}.`, {
        type: "announcement",
        id: studentIds[0],
        title: "Progress review saved",
        route: saved.href,
      }, { data: { saved: saved.saved } })
    }),

  "progressReview.edit": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const reviewId = Number(ctx.args.reviewId ?? ctx.args.review_id)
      const contentMarkdown = asTrimmed(ctx.args.contentMarkdown ?? ctx.args.content_markdown)
      if (!Number.isFinite(reviewId) || reviewId <= 0 || !contentMarkdown) {
        return invalid("reviewId and contentMarkdown are required.")
      }
      const edited = await editProgressReviewContent({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        reviewId,
        contentMarkdown,
      })
      return success("Progress review updated.", {
        type: "announcement",
        id: edited.reviewId,
        title: "Progress review edited",
        route: edited.href,
      })
    }),

  "progressReview.publish": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const studentIds = parseProgressReviewStudentIds(ctx.args)
      const published = await publishProgressReviews({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        studentIds: studentIds.length ? studentIds : null,
        reviewPeriod:
          ctx.args.reviewPeriod != null
            ? String(ctx.args.reviewPeriod)
            : ctx.args.review_period != null
              ? String(ctx.args.review_period)
              : null,
        asOfDate:
          ctx.args.asOfDate != null
            ? String(ctx.args.asOfDate)
            : ctx.args.as_of_date != null
              ? String(ctx.args.as_of_date)
              : null,
        sendEmail: ctx.args.sendEmail !== false && ctx.args.send_email !== false,
        createAnnouncement:
          ctx.args.createAnnouncement !== false && ctx.args.create_announcement !== false,
        createNotification:
          ctx.args.createNotification !== false && ctx.args.create_notification !== false,
      })
      return success(
        `Delivered ${published.dispatched} progress review${published.dispatched === 1 ? "" : "s"} (${published.emailsSent} email${published.emailsSent === 1 ? "" : "s"} sent).`,
        {
          type: "announcement",
          id: ctx.courseId,
          title: "Progress reviews published",
          route: published.href,
        },
        { data: published },
      )
    }),

  "recommendation.draft": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const requestId = Number(ctx.args.requestId ?? ctx.args.request_id)
      const finalLetterText = asTrimmed(
        ctx.args.finalLetterText ?? ctx.args.final_letter_text ?? ctx.args.letterText,
      )
      if (!Number.isFinite(requestId) || requestId <= 0) {
        return invalid("requestId is required.")
      }
      const saved = await saveRecommendationDraftLetter({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        requestId,
        finalLetterText,
      })
      return success("Recommendation letter draft saved.", {
        type: "announcement",
        id: saved.requestId,
        title: "Recommendation draft",
        route: saved.href,
      })
    }),

  "gradingPolicy.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const patchRaw = parseGradingPolicyPatch(ctx.args)
      const patch: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(patchRaw)) {
        if (value !== undefined) patch[key] = value
      }
      if (Object.keys(patch).length === 0) return invalid("Grading policy patch is required.")
      const updated = await updateCourseGradingPolicy({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        patch,
      })
      return success("Grading policy updated.", {
        type: "announcement",
        id: ctx.courseId,
        title: "Grading policy",
        route: updated.href,
      })
    }),

  "attendancePolicy.update": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const patch = parseAttendancePolicyPatch(ctx.args)
      if (Object.keys(patch).length === 0) {
        return invalid("attendance_policy patch is required.")
      }
      const updated = await updateCourseAttendancePolicy({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        patch,
      })
      return success("Attendance policy updated.", {
        type: "announcement",
        id: ctx.courseId,
        title: "Attendance policy",
        route: updated.href,
      })
    }),

  "assessment.grantExtension": async (ctx) =>
    withCourseAccess(ctx, async () => {
      const studentId = Number(ctx.args.studentId ?? ctx.args.student_id)
      const quizId = Number(ctx.args.quizId ?? ctx.args.quiz_id ?? ctx.args.assessmentId)
      if (!Number.isFinite(studentId) || studentId <= 0) return invalid("studentId is required.")
      if (!Number.isFinite(quizId) || quizId <= 0) return invalid("quizId is required.")
      const { grantAssessmentExtension } = await import(
        "@/lib/cora/services/grant-assessment-extension"
      )
      const granted = await grantAssessmentExtension({
        instructorId: ctx.instructorId,
        courseId: ctx.courseId,
        studentId,
        quizId,
        hours: ctx.args.hours != null ? Number(ctx.args.hours) : undefined,
      })
      return success(
        granted.alreadyGranted
          ? `${granted.studentName} already has an active extension on "${granted.quizTitle}" (expires ${granted.expiresAt}).`
          : `Extension granted: ${granted.studentName} has ${granted.hours}h to complete "${granted.quizTitle}".`,
        {
          type: "assessment",
          id: quizId,
          title: granted.quizTitle,
          route: "/module/quizzes",
        },
      )
    }),
}

export const FACULTY_CAPABILITY_HANDLERS: Record<
  string,
  (ctx: FacultyCapabilityHandlerContext) => Promise<FacultyHandlerResult>
> = {
  ...CORE_FACULTY_CAPABILITY_HANDLERS,
  ...EXTENDED_FACULTY_CAPABILITY_HANDLERS,
}

export function hasFacultyCapabilityHandler(id: string): boolean {
  return typeof FACULTY_CAPABILITY_HANDLERS[id] === "function"
}

export function listFacultyCapabilityHandlerIds(): string[] {
  return Object.keys(FACULTY_CAPABILITY_HANDLERS).sort()
}

const facultyRegistryHandlers: Record<string, CapabilityHandler> = {}
for (const [capabilityId, handler] of Object.entries(FACULTY_CAPABILITY_HANDLERS)) {
  facultyRegistryHandlers[capabilityId] = async (ctx) =>
    handler({
      instructorId: ctx.instructorId!,
      courseId: ctx.courseId!,
      courseCode: ctx.courseCode,
      args: ctx.args,
      capabilityId: ctx.capabilityId,
    })
}
registerCapabilityHandlers("faculty", facultyRegistryHandlers)
