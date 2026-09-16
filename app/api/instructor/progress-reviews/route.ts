import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { ensureStudentProgressReviewsSchema } from "@/lib/ensure-student-progress-reviews-schema"
import { gatherStudentProgressData, listCourseStudentIds } from "@/lib/midterm-progress-review/gather-student-data"
import { generateProgressReview } from "@/lib/midterm-progress-review/generate-review"
import { buildProgressReviewDeliveryPreview } from "@/lib/midterm-progress-review/build-delivery-preview"
import { reapplyProgressReviewGradebook } from "@/lib/midterm-progress-review/adjust-gradebook-for-review"
import type { ProgressReviewSections, StudentProgressData } from "@/lib/midterm-progress-review/types"
import { parseReviewPeriod, formatReviewAsOfDateIso } from "@/lib/midterm-progress-review/review-period"
import { readInstructorSessionScopeFromRequest, studentOfferingAndSql } from "@/lib/instructor-session-scope"
import { runMidtermProgressReviewBatch, listMissingReviewStudentIds } from "@/lib/midterm-progress-review/run-batch"
import { runDeliverSavedProgressReviewBatch } from "@/lib/midterm-progress-review/deliver-saved-batch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * GET — list recent reviews (?reviewPeriod=), preview one student (?studentId=), or fetch sent review (?reviewId=)
 * POST — generate + dispatch reviews (batch or single)
 * Body: { reviewPeriod?, asOfDate?, studentIds?, dryRun?, deliverSaved?, sendEmail?, previewOnly? }
 */
export async function GET(req: NextRequest) {
  try {
    const scope = await requireInstructorCourse(req)
    if (!scope.ok) return scope.response

    await ensureStudentProgressReviewsSchema()

    const reviewPeriod = parseReviewPeriod(req.nextUrl.searchParams.get("reviewPeriod") ?? "midterm")
    const asOfDateParam = req.nextUrl.searchParams.get("asOfDate")
    const asOfDate =
      reviewPeriod === "custom" && asOfDateParam?.trim()
        ? String(asOfDateParam).slice(0, 10)
        : null
    const reviewIdRaw = req.nextUrl.searchParams.get("reviewId")
    const studentIdRaw = req.nextUrl.searchParams.get("studentId")

    if (reviewIdRaw) {
      const reviewId = parseInt(reviewIdRaw, 10)
      if (!Number.isFinite(reviewId)) {
        return NextResponse.json({ error: "Invalid reviewId" }, { status: 400 })
      }

      const rows = sqlRows<Record<string, unknown>>(
        await sql`
          SELECT
            spr.id,
            spr.student_id,
            spr.review_period,
            spr.as_of_date,
            spr.progress_data,
            spr.review_sections,
            spr.content_markdown,
            spr.model_used,
            spr.email_sent_at,
            spr.created_at,
            s.full_name,
            s.email,
            s.section
          FROM student_progress_reviews spr
          JOIN students s ON s.id = spr.student_id
          WHERE spr.id = ${reviewId}
            AND spr.course_id = ${scope.course.id}
            ${studentOfferingAndSql(req, scope.course.id, "s")}
          LIMIT 1
        `,
      )

      const row = rows[0]
      if (!row) {
        return NextResponse.json({ error: "Review not found" }, { status: 404 })
      }

      const progressData = row.progress_data as StudentProgressData
      const sections = row.review_sections as ProgressReviewSections
      if (progressData?.gradebook) {
        progressData.gradebook =
          reapplyProgressReviewGradebook({
            gradebook: progressData.gradebook,
            assessments: progressData.assessments ?? [],
            attendance: progressData.attendance,
            classroomPoints: progressData.classroomPoints ?? [],
            practiceHub: progressData.practiceHub,
          }) ?? progressData.gradebook
      }
      const delivery =
        progressData && sections
          ? buildProgressReviewDeliveryPreview(sections, progressData)
          : null

      return NextResponse.json({
        success: true,
        review: {
          id: Number(row.id),
          studentId: Number(row.student_id),
          fullName: String(row.full_name ?? ""),
          email: String(row.email ?? ""),
          section: row.section != null ? String(row.section) : null,
          reviewPeriod: String(row.review_period ?? "midterm"),
          asOfDate: formatReviewAsOfDateIso(row.as_of_date),
          sections,
          progressData,
          contentMarkdown: row.content_markdown != null ? String(row.content_markdown) : null,
          modelUsed: row.model_used != null ? String(row.model_used) : null,
          emailSentAt: row.email_sent_at,
          createdAt: row.created_at,
          delivery,
        },
      })
    }

    if (studentIdRaw) {
      const studentId = parseInt(studentIdRaw, 10)
      if (!Number.isFinite(studentId)) {
        return NextResponse.json({ error: "Invalid studentId" }, { status: 400 })
      }

      const asOfDate = req.nextUrl.searchParams.get("asOfDate")
      const inOffering = sqlRows<{ id: number }>(
        await sql`
          SELECT s.id FROM students s
          WHERE s.id = ${studentId}
            AND (s.deleted_at IS NULL)
            ${studentOfferingAndSql(req, scope.course.id, "s")}
          LIMIT 1
        `,
      )
      if (inOffering.length === 0) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }
      const progressData = await gatherStudentProgressData(studentId, scope.course.id, {
        reviewPeriod,
        asOfDate,
      })
      if (!progressData) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }

      const review = await generateProgressReview(progressData)
      const delivery = buildProgressReviewDeliveryPreview(review.sections, progressData)
      return NextResponse.json({ success: true, progressData, review, delivery })
    }

    // Custom tab also surfaces Cora "targeted practice" reviews (review_period = targeted_practice).
    // Use sql.unsafe string predicates — nested sql`` fragments break Neon (boolean "[object Promise]").
    const safePeriod = reviewPeriod === "final" || reviewPeriod === "custom" ? reviewPeriod : "midterm"
    const safeAsOf =
      asOfDate && /^\d{4}-\d{2}-\d{2}$/.test(asOfDate) ? asOfDate : null
    const periodPred =
      safePeriod === "custom"
        ? `(spr.review_period IN ('custom', 'targeted_practice'))`
        : `(spr.review_period = '${safePeriod}')`
    const asOfPred =
      safePeriod === "custom"
        ? safeAsOf
          ? `(
              spr.review_period = 'targeted_practice'
              OR spr.as_of_date = '${safeAsOf}'::date
            )`
          : `(TRUE)`
        : safeAsOf
          ? `(spr.as_of_date = '${safeAsOf}'::date)`
          : `(spr.as_of_date IS NULL)`

    const rows = sqlRows<Record<string, unknown>>(
      await sql`
        SELECT
          spr.id,
          spr.student_id,
          spr.review_period,
          spr.as_of_date,
          s.full_name,
          s.email,
          s.section,
          spr.model_used,
          spr.email_sent_at,
          spr.created_at
        FROM student_progress_reviews spr
        JOIN students s ON s.id = spr.student_id
        WHERE spr.course_id = ${scope.course.id}
          AND ${sql.unsafe(periodPred)}
          AND ${sql.unsafe(asOfPred)}
          ${studentOfferingAndSql(req, scope.course.id, "s")}
        ORDER BY spr.created_at DESC
      `,
    )

    const countRows = sqlRows<{ count: number | string }>(
      await sql`
        SELECT COUNT(*)::int AS count
        FROM student_progress_reviews spr
        JOIN students s ON s.id = spr.student_id
        WHERE spr.course_id = ${scope.course.id}
          AND ${sql.unsafe(periodPred)}
          AND ${sql.unsafe(asOfPred)}
          ${studentOfferingAndSql(req, scope.course.id, "s")}
      `,
    )
    const savedReviewCount = Number(countRows[0]?.count ?? 0)
    const sessionScope = readInstructorSessionScopeFromRequest(req)
    const enrolledStudentCount = (await listCourseStudentIds(scope.course.id, sessionScope)).length
    // Missing = batch custom/midterm/final gaps only — do not treat targeted_practice as covering the roster.
    const missingReviewCount =
      safePeriod === "custom" && !safeAsOf
        ? 0
        : (
            await listMissingReviewStudentIds(scope.course.id, safePeriod, safeAsOf, sessionScope)
          ).length

    return NextResponse.json({
      success: true,
      reviewPeriod,
      asOfDate,
      savedReviewCount,
      enrolledStudentCount,
      missingReviewCount,
      reviews: rows.map((r) => ({
        id: Number(r.id),
        studentId: Number(r.student_id),
        reviewPeriod: String(r.review_period ?? reviewPeriod),
        asOfDate: formatReviewAsOfDateIso(r.as_of_date),
        fullName: String(r.full_name ?? ""),
        email: String(r.email ?? ""),
        section: r.section != null ? String(r.section) : null,
        modelUsed: r.model_used != null ? String(r.model_used) : null,
        emailSentAt: r.email_sent_at,
        createdAt: r.created_at,
      })),
      studentCount: enrolledStudentCount,
    })
  } catch (e) {
    console.error("[instructor/progress-reviews GET]", e)
    return NextResponse.json({ error: "Failed to load progress reviews" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = await requireInstructorCourse(req)
    if (!scope.ok) return scope.response

    await ensureStudentProgressReviewsSchema()

    const body = await req.json().catch(() => ({}))
    const dryRun = body.dryRun === true
    const deliverSaved = body.deliverSaved === true
    const previewOnly = body.previewOnly === true
    const onlyMissing = body.onlyMissing === true
    const sendEmail = body.sendEmail !== false
    const createAnnouncement = body.createAnnouncement !== false
    const createNotification = body.createNotification !== false
    const reviewPeriod = parseReviewPeriod(body.reviewPeriod ?? "midterm")
    const asOfDate =
      reviewPeriod === "custom" && body.asOfDate ? String(body.asOfDate).slice(0, 10) : null

    if (reviewPeriod === "custom" && !asOfDate && !previewOnly) {
      return NextResponse.json(
        { error: "As-of date is required for custom progress reviews" },
        { status: 400 },
      )
    }

    const sessionScope = readInstructorSessionScopeFromRequest(req)
    const roster = new Set(await listCourseStudentIds(scope.course.id, sessionScope))
    const studentIds: number[] = Array.isArray(body.studentIds)
      ? body.studentIds.map(Number).filter((n: number) => Number.isFinite(n) && roster.has(n))
      : []

    if (previewOnly && Array.isArray(body.studentIds) && body.studentIds.length === 1 && studentIds.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    if (previewOnly && studentIds.length === 1) {
      const progressData = await gatherStudentProgressData(studentIds[0], scope.course.id, {
        reviewPeriod,
        asOfDate,
      })
      if (!progressData) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }
      const review = await generateProgressReview(progressData)
      const delivery = buildProgressReviewDeliveryPreview(review.sections, progressData)
      return NextResponse.json({ success: true, dryRun: true, progressData, review, delivery })
    }

    if (deliverSaved) {
      if (dryRun) {
        return NextResponse.json(
          { error: "Turn off dry run or use Deliver saved reviews instead of dry run + deliverSaved" },
          { status: 400 },
        )
      }
      const result = await runDeliverSavedProgressReviewBatch({
        courseId: scope.course.id,
        instructorId: scope.instructorId,
        studentIds: studentIds.length > 0 ? studentIds : undefined,
        sessionScope,
        reviewPeriod,
        asOfDate,
        sendEmail,
        createAnnouncement,
        createNotification,
      })
      return NextResponse.json({ success: true, result, reviewPeriod, asOfDate, deliverSaved: true })
    }

    const result = await runMidtermProgressReviewBatch({
      courseId: scope.course.id,
      instructorId: scope.instructorId,
      studentIds: studentIds.length > 0 ? studentIds : undefined,
      sessionScope,
      reviewPeriod,
      asOfDate,
      dryRun,
      onlyMissing,
      sendEmail: dryRun ? false : sendEmail,
      createAnnouncement: dryRun ? false : createAnnouncement,
      createNotification: dryRun ? false : createNotification,
    })

    return NextResponse.json({ success: true, result, reviewPeriod, asOfDate })
  } catch (e) {
    console.error("[instructor/progress-reviews POST]", e)
    return NextResponse.json({ error: "Failed to run progress reviews" }, { status: 500 })
  }
}
