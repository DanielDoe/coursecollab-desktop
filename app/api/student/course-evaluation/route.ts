import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureCourseEvaluationSchema } from "@/lib/ensure-course-evaluation-schema"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import { saveCourseEvaluationProofFile } from "@/lib/course-evaluation-storage"
import { heicJpegFileName, isHeicMimeOrName } from "@/lib/heic-image"
import { convertHeicBufferToJpeg } from "@/lib/heic-convert-server"
import { COURSE_EVALUATION_ENGAGEMENT_CREDITS } from "@/lib/course-evaluation-engagement"
import { isValidPassExpectationGrade } from "@/lib/grade-utils"
import {
  isValidAiTutorUsage,
  isValidFeatureToImprove,
  isValidWorkload,
  parseFavoriteFeatures,
  parseLikert1to5,
  parseNps,
  SURVEY_OTHER_OPTION,
} from "@/lib/course-evaluation-survey"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const MAX_BYTES = 25 * 1024 * 1024
const MAX_PROOFS = 10

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "image/heic",
  "image/heif",
])

const EVALUATION_SELECT = `
  id, course_rating, improvement_suggestions, self_assessed_letter_grade,
  platform_helpfulness, favorite_features, favorite_features_other, feature_to_improve,
  feature_to_improve_other, instructor_clarity, workload, ai_tutor_usage, nps_score, missing_features,
  status, instructor_note, submitted_at, reviewed_at, created_at, updated_at
`

function inferUploadMime(file: File): string {
  const fromType = (file.type || "").toLowerCase().split(";")[0]?.trim()
  if (fromType && ALLOWED_MIME.has(fromType)) return fromType
  const name = (file.name || "").toLowerCase()
  if (name.endsWith(".png")) return "image/png"
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg"
  if (name.endsWith(".webp")) return "image/webp"
  if (name.endsWith(".gif")) return "image/gif"
  if (name.endsWith(".pdf")) return "application/pdf"
  if (name.endsWith(".heic")) return "image/heic"
  if (name.endsWith(".heif")) return "image/heif"
  return fromType || ""
}

function collectUploadFiles(formData: FormData): File[] {
  const seen = new Set<string>()
  const out: File[] = []
  for (const key of ["files", "proof", "proofImages", "proofPdf"]) {
    for (const entry of formData.getAll(key)) {
      if (!(entry instanceof File) || entry.size <= 0) continue
      const sig = `${entry.name}:${entry.size}:${entry.lastModified}`
      if (seen.has(sig)) continue
      seen.add(sig)
      out.push(entry)
    }
  }
  return out.slice(0, MAX_PROOFS)
}

async function countProofsForEvaluation(evaluationId: number): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS c FROM course_evaluation_proofs WHERE evaluation_id = ${evaluationId}
  `
  return Number((rows[0] as { c: number })?.c ?? 0)
}

async function insertProofFiles(
  studentDbId: number,
  evaluationId: number,
  files: File[],
): Promise<Array<{ url: string; name: string; mime: string }>> {
  const savedProofs = []
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      throw new Error("Each file must be 25 MB or smaller")
    }
    const mime = inferUploadMime(file)
    if (!mime || !ALLOWED_MIME.has(mime)) {
      throw new Error("Allowed types: PNG, JPEG, WebP, GIF, PDF, HEIC")
    }

    let uploadFile: File = file
    let storedMime = mime
    if (isHeicMimeOrName(mime, file.name)) {
      const buf = Buffer.from(await file.arrayBuffer())
      const jpeg = await convertHeicBufferToJpeg(buf)
      storedMime = "image/jpeg"
      uploadFile = new File([jpeg], heicJpegFileName(file.name), { type: storedMime })
    }

    const saved = await saveCourseEvaluationProofFile(studentDbId, evaluationId, uploadFile, storedMime)
    await sql`
      INSERT INTO course_evaluation_proofs (evaluation_id, url, file_name, mime)
      VALUES (${evaluationId}, ${saved.url}, ${saved.name}, ${storedMime})
    `
    savedProofs.push(saved)
  }
  return savedProofs
}

function normalizeFavoriteFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch {
      return []
    }
  }
  return []
}

async function fetchEvaluationWithProofs(studentDbId: number, session: string) {
  const rows = await sql`
    SELECT ${sql.unsafe(EVALUATION_SELECT)}
    FROM course_evaluations
    WHERE student_id = ${studentDbId} AND session = ${session}
    LIMIT 1
  `
  if (rows.length === 0) return null
  const evaluation = rows[0] as Record<string, unknown>
  const proofs = await sql`
    SELECT id, url, file_name, mime, uploaded_at
    FROM course_evaluation_proofs
    WHERE evaluation_id = ${evaluation.id}
    ORDER BY uploaded_at ASC
  `
  return {
    ...evaluation,
    favorite_features: normalizeFavoriteFeatures(evaluation.favorite_features),
    proofs,
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureCourseEvaluationSchema()
    const { searchParams } = new URL(request.url)
    const rawStudent = searchParams.get("studentId") ?? searchParams.get("studentDatabaseId")
    const session = (searchParams.get("session") ?? "ALL").trim() || "ALL"
    if (!rawStudent) {
      return NextResponse.json({ error: "studentId required" }, { status: 400 })
    }
    const studentDbId = await resolveStudentDatabaseIdFromParam(rawStudent)
    if (studentDbId == null) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const evaluation = await fetchEvaluationWithProofs(studentDbId, session)
    return NextResponse.json({
      success: true,
      evaluation,
      engagementCreditsOnApproval: COURSE_EVALUATION_ENGAGEMENT_CREDITS,
    })
  } catch (error) {
    console.error("[student/course-evaluation GET]", error)
    return NextResponse.json({ error: "Failed to load evaluation" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureCourseEvaluationSchema()
    const formData = await request.formData()
    const rawStudent = String(formData.get("studentId") ?? formData.get("studentDatabaseId") ?? "").trim()
    const session = String(formData.get("session") ?? "ALL").trim() || "ALL"

    const overallExperience = parseLikert1to5(
      formData.get("overallExperience") ?? formData.get("courseRating"),
      "overallExperience",
    )
    const platformHelpfulness = parseLikert1to5(formData.get("platformHelpfulness"), "platformHelpfulness")
    const favoriteFeatures = parseFavoriteFeatures(formData.getAll("favoriteFeatures"))
    const featureToImprove = String(formData.get("featureToImprove") ?? "").trim()
    const favoriteFeaturesOther = String(formData.get("favoriteFeaturesOther") ?? "").trim()
    const featureToImproveOther = String(formData.get("featureToImproveOther") ?? "").trim()
    const openFeedback = String(formData.get("openFeedback") ?? formData.get("improvementSuggestions") ?? "").trim()
    const selfAssessedGrade = String(
      formData.get("selfAssessedLetterGrade") ?? formData.get("selfAssessedGrade") ?? "",
    ).trim()

    const instructorClarityRaw = String(formData.get("instructorClarity") ?? "").trim()
    const workloadRaw = String(formData.get("workload") ?? "").trim()
    const aiTutorUsageRaw = String(formData.get("aiTutorUsage") ?? "").trim()
    const npsRaw = String(formData.get("npsScore") ?? "").trim()
    const missingFeatures = String(formData.get("missingFeatures") ?? "").trim()

    const instructorClarity = instructorClarityRaw ? parseLikert1to5(instructorClarityRaw, "instructorClarity") : null
    const workload = workloadRaw && isValidWorkload(workloadRaw) ? workloadRaw : null
    const aiTutorUsage = aiTutorUsageRaw && isValidAiTutorUsage(aiTutorUsageRaw) ? aiTutorUsageRaw : null
    const npsScore = npsRaw ? parseNps(npsRaw) : null

    if (!rawStudent) {
      return NextResponse.json({ error: "studentId required" }, { status: 401 })
    }
    if (overallExperience == null) {
      return NextResponse.json({ error: "Rate your overall course experience (1–5)" }, { status: 400 })
    }
    if (platformHelpfulness == null) {
      return NextResponse.json({ error: "Rate how much CourseCollab improved your learning (1–5)" }, { status: 400 })
    }
    if (favoriteFeatures.length === 0) {
      return NextResponse.json({ error: "Select at least one valuable CourseCollab feature" }, { status: 400 })
    }
    if (!isValidFeatureToImprove(featureToImprove)) {
      return NextResponse.json({ error: "Choose one CourseCollab feature to improve first" }, { status: 400 })
    }
    if (favoriteFeatures.includes(SURVEY_OTHER_OPTION) && favoriteFeaturesOther.length < 2) {
      return NextResponse.json({ error: "Describe the other valuable feature(s) you selected" }, { status: 400 })
    }
    if (featureToImprove === SURVEY_OTHER_OPTION && featureToImproveOther.length < 2) {
      return NextResponse.json({ error: "Describe what you would improve when selecting Other" }, { status: 400 })
    }
    if (!isValidPassExpectationGrade(selfAssessedGrade)) {
      return NextResponse.json(
        { error: "Select the grade that would feel like a pass for you in this course" },
        { status: 400 },
      )
    }
    if (openFeedback.length < 10) {
      return NextResponse.json(
        { error: "Share at least one improvement suggestion (10+ characters)" },
        { status: 400 },
      )
    }
    if (instructorClarityRaw && instructorClarity == null) {
      return NextResponse.json({ error: "Instructor clarity rating must be 1–5" }, { status: 400 })
    }
    if (npsRaw && npsScore == null) {
      return NextResponse.json({ error: "Recommendation score must be 0–10" }, { status: 400 })
    }

    const files = collectUploadFiles(formData)

    const studentDbId = await resolveStudentDatabaseIdFromParam(rawStudent)
    if (studentDbId == null) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const existing = await sql`
      SELECT id, status FROM course_evaluations
      WHERE student_id = ${studentDbId} AND session = ${session}
      LIMIT 1
    `
    if (existing.length > 0 && (existing[0] as { status: string }).status === "approved") {
      return NextResponse.json({ error: "Your evaluation is already approved" }, { status: 409 })
    }
    if (existing.length > 0 && (existing[0] as { status: string }).status === "pending") {
      return NextResponse.json({ error: "Your evaluation is awaiting instructor review" }, { status: 409 })
    }

    const existingEvaluationId =
      existing.length > 0 ? (existing[0] as { id: number }).id : null
    const existingProofCount = existingEvaluationId
      ? await countProofsForEvaluation(existingEvaluationId)
      : 0

    if (files.length === 0 && existingProofCount === 0) {
      return NextResponse.json(
        { error: "Upload at least one screenshot or PDF of your Canvas course evaluation" },
        { status: 400 },
      )
    }
    if (files.length > MAX_PROOFS) {
      return NextResponse.json({ error: `Maximum ${MAX_PROOFS} proof files` }, { status: 400 })
    }

    const favoriteFeaturesJson = JSON.stringify(favoriteFeatures)

    let evaluationId: number
    if (existing.length > 0) {
      evaluationId = (existing[0] as { id: number }).id
      await sql`
        UPDATE course_evaluations
        SET course_rating = ${overallExperience},
            platform_helpfulness = ${platformHelpfulness},
            favorite_features = ${favoriteFeaturesJson}::jsonb,
            favorite_features_other = ${favoriteFeaturesOther || null},
            feature_to_improve = ${featureToImprove},
            feature_to_improve_other = ${featureToImproveOther || null},
            improvement_suggestions = ${openFeedback},
            self_assessed_letter_grade = ${selfAssessedGrade},
            instructor_clarity = ${instructorClarity},
            workload = ${workload},
            ai_tutor_usage = ${aiTutorUsage},
            nps_score = ${npsScore},
            missing_features = ${missingFeatures || null},
            status = 'pending',
            instructor_note = NULL,
            reviewed_by = NULL,
            reviewed_at = NULL,
            submitted_at = NOW(),
            updated_at = NOW()
        WHERE id = ${evaluationId}
      `
    } else {
      const inserted = await sql`
        INSERT INTO course_evaluations (
          student_id, session, course_rating, platform_helpfulness, favorite_features,
          favorite_features_other, feature_to_improve, feature_to_improve_other,
          improvement_suggestions, self_assessed_letter_grade,
          instructor_clarity, workload, ai_tutor_usage, nps_score, missing_features,
          status, submitted_at
        )
        VALUES (
          ${studentDbId}, ${session}, ${overallExperience}, ${platformHelpfulness},
          ${favoriteFeaturesJson}::jsonb, ${favoriteFeaturesOther || null}, ${featureToImprove},
          ${featureToImproveOther || null}, ${openFeedback},
          ${selfAssessedGrade}, ${instructorClarity}, ${workload}, ${aiTutorUsage},
          ${npsScore}, ${missingFeatures || null}, 'pending', NOW()
        )
        RETURNING id
      `
      evaluationId = (inserted[0] as { id: number }).id
    }

    let savedProofs: Array<{ url: string; name: string; mime: string }> = []
    if (files.length > 0) {
      await sql`DELETE FROM course_evaluation_proofs WHERE evaluation_id = ${evaluationId}`
      try {
        savedProofs = await insertProofFiles(studentDbId, evaluationId, files)
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "Proof upload failed"
        return NextResponse.json({ error: message }, { status: 400 })
      }
    }

    const evaluation = await fetchEvaluationWithProofs(studentDbId, session)
    return NextResponse.json({
      success: true,
      evaluation,
      proofs: savedProofs.length > 0 ? savedProofs : evaluation?.proofs ?? [],
    })
  } catch (error) {
    console.error("[student/course-evaluation POST]", error)
    return NextResponse.json({ error: "Failed to submit evaluation" }, { status: 500 })
  }
}
