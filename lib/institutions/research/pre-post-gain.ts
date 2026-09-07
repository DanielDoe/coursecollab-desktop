import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { MIN_CELL_SIZE } from "@/lib/institutions/research/capability-catalog"
import type { InstitutionNamedCount } from "@/lib/institutions/insights"
import type { InstitutionScope } from "@/lib/institutions/metrics/types"

export type PrePostGainAnalytics = {
  available: boolean
  studyId: number | null
  studyName: string | null
  pairedN: number
  meanPre: number | null
  meanPost: number | null
  meanGain: number | null
  normalizedGain: number | null
  note: string
  funnel: InstitutionNamedCount[]
}

export async function upsertResearchInstrument(input: {
  institutionId: number
  studyId: number
  instrumentRole: "pre" | "post"
  quizId: number
  label: string
  maxScore?: number
}): Promise<void> {
  await ensureInstitutionSchema()
  await sql`
    INSERT INTO institution_research_instruments (
      institution_id, study_id, instrument_role, quiz_id, label, max_score
    ) VALUES (
      ${input.institutionId},
      ${input.studyId},
      ${input.instrumentRole},
      ${input.quizId},
      ${input.label.slice(0, 200)},
      ${input.maxScore ?? 100}
    )
    ON CONFLICT (study_id, instrument_role) DO UPDATE SET
      quiz_id = EXCLUDED.quiz_id,
      label = EXCLUDED.label,
      max_score = EXCLUDED.max_score
  `
}

export async function getPrePostGainAnalytics(
  scope: InstitutionScope,
  institutionId: number,
): Promise<PrePostGainAnalytics> {
  const note =
    "Paired gain uses configured pre/post quizzes on the same learners. Descriptive only — not a causal estimate."
  if (scope.courseIds.length === 0) {
    return {
      available: false,
      studyId: null,
      studyName: null,
      pairedN: 0,
      meanPre: null,
      meanPost: null,
      meanGain: null,
      normalizedGain: null,
      note,
      funnel: [],
    }
  }

  await ensureInstitutionSchema()
  const studies = (await sql`
    SELECT s.id, s.name
    FROM institution_research_studies s
    WHERE s.institution_id = ${institutionId}
      AND s.design = 'pre_post'
      AND s.status IN ('configured', 'authorized')
    ORDER BY s.updated_at DESC
    LIMIT 1
  `.catch(() => [])) as Array<{ id: number; name: string }>

  const study = studies[0]
  if (!study) {
    return {
      available: false,
      studyId: null,
      studyName: null,
      pairedN: 0,
      meanPre: null,
      meanPost: null,
      meanGain: null,
      normalizedGain: null,
      note: "Configure a pre/post study with linked pre and post quiz instruments.",
      funnel: [],
    }
  }

  const instruments = (await sql`
    SELECT instrument_role, quiz_id, max_score
    FROM institution_research_instruments
    WHERE institution_id = ${institutionId} AND study_id = ${Number(study.id)}
  `.catch(() => [])) as Array<{ instrument_role: string; quiz_id: number; max_score: number }>

  const pre = instruments.find((i) => i.instrument_role === "pre")
  const post = instruments.find((i) => i.instrument_role === "post")
  if (!pre?.quiz_id || !post?.quiz_id) {
    return {
      available: false,
      studyId: Number(study.id),
      studyName: String(study.name),
      pairedN: 0,
      meanPre: null,
      meanPost: null,
      meanGain: null,
      normalizedGain: null,
      note: "Link pre and post quizzes to the study via institution research instruments.",
      funnel: [],
    }
  }

  const maxScore = Number(post.max_score ?? pre.max_score ?? 100)
  const rows = (await sql`
    WITH pre_scores AS (
      SELECT qa.student_id, MAX(qa.score::float) AS score
      FROM quiz_attempts qa
      JOIN students st ON st.id = qa.student_id
      WHERE qa.quiz_id = ${Number(pre.quiz_id)}
        AND st.course_id = ANY(${scope.courseIds})
        AND qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
        AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
      GROUP BY 1
    ),
    post_scores AS (
      SELECT qa.student_id, MAX(qa.score::float) AS score
      FROM quiz_attempts qa
      JOIN students st ON st.id = qa.student_id
      WHERE qa.quiz_id = ${Number(post.quiz_id)}
        AND st.course_id = ANY(${scope.courseIds})
        AND qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
        AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
      GROUP BY 1
    )
    SELECT p.student_id, p.score AS pre_score, o.score AS post_score
    FROM pre_scores p
    JOIN post_scores o ON o.student_id = p.student_id
  `.catch(() => [])) as Array<{ student_id: number; pre_score: number; post_score: number }>

  const pairedN = rows.length
  if (pairedN < MIN_CELL_SIZE) {
    return {
      available: false,
      studyId: Number(study.id),
      studyName: String(study.name),
      pairedN,
      meanPre: null,
      meanPost: null,
      meanGain: null,
      normalizedGain: null,
      note: `Need at least ${MIN_CELL_SIZE} learners with both pre and post scores (N=${pairedN}).`,
      funnel: [
        { key: "pre", name: "Pre attempt", value: pairedN },
        { key: "post", name: "Post attempt", value: pairedN },
      ],
    }
  }

  const preVals = rows.map((r) => Number(r.pre_score))
  const postVals = rows.map((r) => Number(r.post_score))
  const gains = rows.map((r) => Number(r.post_score) - Number(r.pre_score))
  const norm = rows
    .map((r) => {
      const pre = Number(r.pre_score)
      const post = Number(r.post_score)
      const denom = maxScore - pre
      return denom > 0 ? (post - pre) / denom : null
    })
    .filter((v): v is number => v != null)

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const meanPre = mean(preVals)
  const meanPost = mean(postVals)
  const meanGain = mean(gains)
  const normalizedGain = mean(norm)

  return {
    available: true,
    studyId: Number(study.id),
    studyName: String(study.name),
    pairedN,
    meanPre: meanPre != null ? Math.round(meanPre * 10) / 10 : null,
    meanPost: meanPost != null ? Math.round(meanPost * 10) / 10 : null,
    meanGain: meanGain != null ? Math.round(meanGain * 10) / 10 : null,
    normalizedGain: normalizedGain != null ? Math.round(normalizedGain * 1000) / 1000 : null,
    note,
    funnel: [
      { key: "pre", name: "Pre score (mean)", value: meanPre != null ? Math.round(meanPre) : 0 },
      { key: "post", name: "Post score (mean)", value: meanPost != null ? Math.round(meanPost) : 0 },
      { key: "gain", name: "Mean gain", value: meanGain != null ? Math.round(meanGain) : 0 },
    ],
  }
}
