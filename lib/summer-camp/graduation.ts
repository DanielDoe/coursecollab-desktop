import { sql } from "@/lib/db"
import { getCamperProfile } from "@/lib/summer-camp/camper-profile"
import {
  issueCampCertificate,
  listFeedbackCards,
  listGalleryEntries,
  listTrainingAwards,
  SHOWCASE_AWARD_TYPES,
} from "@/lib/summer-camp/showcase"

export type GraduationRequirement = {
  id: string
  label: string
  met: boolean
  detail?: string
}

export async function getGraduationEligibility(studentDbId: number, trainingId: number) {
  const modules = await sql`
    SELECT m.id, m.sort_order, m.title
    FROM camp_modules m
    JOIN camp_projects p ON p.id = m.project_id
    WHERE p.training_id = ${trainingId} AND m.status = 'published'
    ORDER BY m.sort_order ASC
  `

  const completed = await sql`
    SELECT DISTINCT module_id FROM camp_progress
    WHERE student_id = ${studentDbId}
      AND progress_type = 'module_complete'
      AND module_id IN (
        SELECT m.id FROM camp_modules m
        JOIN camp_projects p ON p.id = m.project_id
        WHERE p.training_id = ${trainingId}
      )
  `
  const completedSet = new Set(completed.map((r) => Number((r as { module_id: number }).module_id)))

  const showcaseModule = modules.find((m) => {
    const title = String((m as { title: string }).title).toLowerCase()
    return title.includes("final project showcase") || title.includes("showcase")
  })
  const showcaseModuleId = showcaseModule ? Number((showcaseModule as { id: number }).id) : null

  const videoSubmission = showcaseModuleId
    ? await sql`
        SELECT id, status FROM camp_submissions
        WHERE student_id = ${studentDbId} AND module_id = ${showcaseModuleId}
          AND (file_name ILIKE '%.mp4' OR file_url IS NOT NULL)
        ORDER BY submitted_at DESC LIMIT 1
      `
    : []

  const screenshotCount = showcaseModuleId
    ? await sql`
        SELECT COUNT(*)::int AS cnt FROM camp_submissions
        WHERE student_id = ${studentDbId} AND module_id = ${showcaseModuleId}
          AND status IN ('submitted', 'approved', 'reviewed')
      `
    : [{ cnt: 0 }]

  const profile = await getCamperProfile(studentDbId)
  const survey = (profile.profile?.finalCampSurvey ?? {}) as Record<string, unknown>
  const reportDraft = (profile.profile?.engineeringReflectionReport ?? {}) as Record<string, string>

  const certRows = await sql`
    SELECT id, verification_code, issued_at, linkedin_share_url
    FROM camp_certificates
    WHERE student_id = ${studentDbId} AND training_id = ${trainingId}
    LIMIT 1
  `

  const totalModules = modules.length
  const modulesDone = completedSet.size
  const allModulesComplete = totalModules > 0 && modulesDone >= totalModules

  const videoStatus = videoSubmission[0] as { status?: string } | undefined
  const hasVideo = Boolean(videoSubmission.length > 0)
  const videoApproved = videoStatus?.status === "approved"

  const screenshotCnt = Number((screenshotCount[0] as { cnt: number })?.cnt ?? 0)
  const hasScreenshots = screenshotCnt >= 3

  const surveyComplete = Boolean(survey.learned && survey.confidenceAfter != null)
  const hasReportDraft = Boolean(reportDraft.learned?.trim())

  const requirements: GraduationRequirement[] = [
    {
      id: "modules",
      label: "Complete Modules 0–10 (curriculum through face & eye detection)",
      met: modulesDone >= Math.max(0, totalModules - 1),
      detail: `${modulesDone} / ${totalModules} modules`,
    },
    {
      id: "showcase",
      label: "Complete Final Project Showcase (Module 11)",
      met: showcaseModuleId ? completedSet.has(showcaseModuleId) : false,
    },
    {
      id: "video",
      label: "Submit Video Demonstration",
      met: hasVideo,
      detail: videoApproved ? "Approved" : videoStatus?.status ?? "Pending",
    },
    {
      id: "screenshots",
      label: "Submit Screenshot Evidence",
      met: hasScreenshots,
      detail: `${screenshotCnt} submissions`,
    },
    {
      id: "survey",
      label: "Complete Final Reflection Survey",
      met: surveyComplete,
    },
    {
      id: "report",
      label: "Engineering Reflection Report",
      met: hasReportDraft,
    },
  ]

  const readyToGraduate = requirements.every((r) => r.met)

  let certificate = certRows[0] ?? null
  if (readyToGraduate && !certificate) {
    try {
      certificate = await issueCampCertificate(studentDbId, trainingId)
    } catch {
      /* may already exist */
    }
  }

  return {
    requirements,
    ready_to_graduate: readyToGraduate,
    modules_completed: modulesDone,
    modules_total: totalModules,
    certificate,
  }
}

export async function hubGraduation(studentDbId: number) {
  const enrollments = await sql`
    SELECT e.training_id, t.title AS training_title, c.title AS camp_title
    FROM camp_enrollments e
    JOIN camp_trainings t ON t.id = e.training_id
    JOIN summer_camps c ON c.id = e.camp_id
    WHERE e.student_id = ${studentDbId} AND e.status = 'active'
  `

  const profile = await getCamperProfile(studentDbId)
  const trainingResults = []

  for (const en of enrollments as Array<{ training_id: number; training_title: string; camp_title: string }>) {
    const eligibility = await getGraduationEligibility(studentDbId, en.training_id)
    const gallery = await listGalleryEntries(en.training_id, studentDbId)
    const awards = await listTrainingAwards(en.training_id)
    const feedbackCards = await listFeedbackCards(studentDbId, en.training_id)

    const myEntry = gallery.find((g) => Number((g as { student_id: number }).student_id) === studentDbId)

    trainingResults.push({
      training_id: en.training_id,
      training_title: en.training_title,
      camp_title: en.camp_title,
      ...eligibility,
      my_gallery_entry: myEntry ?? null,
      gallery_count: gallery.length,
      awards: awards.map((a) => ({
        ...a,
        label: SHOWCASE_AWARD_TYPES[(a as { award_type: string }).award_type as keyof typeof SHOWCASE_AWARD_TYPES],
      })),
      feedback_cards: feedbackCards,
      total_xp: profile.total_xp,
      badges: profile.badges,
    })
  }

  return {
    trainings: trainingResults,
    total_xp: profile.total_xp,
    badges: profile.badges,
  }
}

export async function hubGallery(studentDbId: number, trainingId?: number) {
  let trainingIds: number[] = []
  if (trainingId != null) {
    trainingIds = [trainingId]
  } else {
    const ens = await sql`
      SELECT training_id FROM camp_enrollments
      WHERE student_id = ${studentDbId} AND status = 'active'
    `
    trainingIds = ens.map((e) => Number((e as { training_id: number }).training_id))
  }

  if (trainingIds.length === 0) {
    return { entries: [], awards: [], training_id: null }
  }

  const tid = trainingIds[0]
  const entries = await listGalleryEntries(tid, studentDbId)
  const awards = await listTrainingAwards(tid)

  const peoplesChoiceLeaderboard = [...entries]
    .sort((a, b) => Number((b as { vote_count: number }).vote_count) - Number((a as { vote_count: number }).vote_count))
    .slice(0, 10)

  return {
    training_id: tid,
    entries,
    awards,
    peoples_choice_leaderboard: peoplesChoiceLeaderboard,
    award_types: SHOWCASE_AWARD_TYPES,
  }
}
