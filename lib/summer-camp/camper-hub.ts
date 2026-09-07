import { sql } from "@/lib/db"
import { getTrainingMeta, TRAINING_CATALOG } from "@/lib/summer-camp/training-catalog"
import {
  getCertificateDisplayTitle,
  getCertificateIssuerLine,
  XR_ATTENTION_CERTIFICATE_TYPE,
  XR_ATTENTION_TRAINING_SLUG,
} from "@/lib/summer-camp/certificate-training-config"
import { getCurriculumProgress } from "@/lib/summer-camp/curriculum-progress"
import {
  computeCampXpFromProgress,
  formatCampDisplayName,
  syncCampCamperXp,
} from "@/lib/summer-camp/camp-xp"
import { sortCampModulesBySchedule } from "@/lib/summer-camp/module-schedule"

export async function getEnrollments(studentDbId: number) {
  return sql`
    SELECT
      e.id AS enrollment_id,
      e.status,
      e.enrolled_at,
      t.id AS training_id,
      t.slug AS training_slug,
      t.title AS training_title,
      t.description AS training_description,
      c.id AS camp_id,
      c.title AS camp_title,
      c.slug AS camp_slug,
      c.start_date,
      c.end_date
    FROM camp_enrollments e
    JOIN camp_trainings t ON t.id = e.training_id
    JOIN summer_camps c ON c.id = e.camp_id
    WHERE e.student_id = ${studentDbId} AND e.status = 'active'
    ORDER BY e.enrolled_at DESC
  `
}

async function getTrainingProgress(studentDbId: number, trainingId: number) {
  const modulesRaw = (await sql`
    SELECT m.id, m.title, m.sort_order, m.schedule_day, m.schedule_day_sort, m.display_number,
           COALESCE(m.is_visible, true) AS is_visible
    FROM camp_modules m
    JOIN camp_projects p ON p.id = m.project_id
    WHERE p.training_id = ${trainingId}
      AND m.status = 'published'
      AND COALESCE(m.is_visible, true) = true
  `) as Array<{
    id: number
    title: string
    sort_order: number
    schedule_day: number | null
    schedule_day_sort: number
    display_number: number | null
  }>

  const modules = sortCampModulesBySchedule(modulesRaw)

  const completed = (await sql`
    SELECT DISTINCT module_id FROM camp_progress
    WHERE student_id = ${studentDbId}
      AND progress_type = 'module_complete'
      AND module_id IN (
        SELECT m.id FROM camp_modules m
        JOIN camp_projects p ON p.id = m.project_id
        WHERE p.training_id = ${trainingId}
      )
  `) as Array<{ module_id: number }>

  const completedSet = new Set(completed.map((r) => r.module_id))
  const total = modules.length
  const done = completedSet.size
  return {
    total_modules: total,
    completed_modules: done,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
    modules: modules.map((m) => ({
      ...m,
      is_complete: completedSet.has(m.id),
    })),
  }
}

async function getFacultyForTraining(trainingId: number) {
  return sql`
    SELECT i.id, i.name, i.email, i.job_title, i.institution, i.phone, i.office, f.role
    FROM camp_training_faculty f
    JOIN instructors i ON i.id = f.instructor_id
    WHERE f.training_id = ${trainingId}
    ORDER BY CASE
      WHEN f.role = 'lead' THEN 0
      WHEN f.role = 'dean' THEN 1
      ELSE 2
    END, i.name ASC
  `
}

export { getFacultyForTraining }

export async function hubDashboard(studentDbId: number) {
  const xpState = await syncCampCamperXp(studentDbId)
  const enrollments = (await getEnrollments(studentDbId)) as Array<{ training_id: number }>
  const progress = []
  for (const en of enrollments) {
    const p = await getTrainingProgress(studentDbId, en.training_id)
    progress.push({ training_id: en.training_id, ...p })
  }

  const overallPercent =
    progress.length > 0
      ? Math.round(progress.reduce((s, p) => s + p.percent, 0) / progress.length)
      : 0

  const upcomingCheckpoints = await sql`
    SELECT
      b.id AS block_id,
      b.content,
      m.id AS module_id,
      m.title AS module_title,
      t.id AS training_id,
      t.title AS training_title
    FROM camp_module_blocks b
    JOIN camp_modules m ON m.id = b.module_id
    JOIN camp_projects p ON p.id = m.project_id
    JOIN camp_trainings t ON t.id = p.training_id
    JOIN camp_enrollments e ON e.training_id = t.id AND e.student_id = ${studentDbId}
    WHERE b.block_type = 'checkpoint'
      AND m.status = 'published'
      AND NOT EXISTS (
        SELECT 1 FROM camp_submissions s
        WHERE s.student_id = ${studentDbId} AND s.block_id = b.id
          AND s.status IN ('submitted', 'approved', 'reviewed')
      )
    ORDER BY m.sort_order ASC, b.sort_order ASC
    LIMIT 8
  `

  const recentFeedback = await sql`
    SELECT
      s.id, s.feedback, s.status, s.reviewed_at,
      m.id AS module_id, m.title AS module_title,
      b.content AS block_content
    FROM camp_submissions s
    JOIN camp_modules m ON m.id = s.module_id
    JOIN camp_module_blocks b ON b.id = s.block_id
    WHERE s.student_id = ${studentDbId} AND s.feedback IS NOT NULL
    ORDER BY s.reviewed_at DESC NULLS LAST
    LIMIT 5
  `

  const recentDiscussions = await sql`
    SELECT d.id, d.title, d.status, d.updated_at, m.id AS module_id, m.title AS module_title
    FROM camp_discussions d
    JOIN camp_modules m ON m.id = d.module_id
    WHERE d.student_id = ${studentDbId} AND d.parent_id IS NULL
    ORDER BY d.updated_at DESC
    LIMIT 5
  `

  const camps = await sql`
    SELECT id, title, description, start_date, end_date
    FROM summer_camps
    WHERE status IN ('published', 'active')
    ORDER BY start_date DESC NULLS LAST
    LIMIT 1
  `

  const announcements = camps[0]
    ? [
        {
          id: 1,
          title: `${(camps[0] as { title: string }).title} is live`,
          body: (camps[0] as { description: string | null }).description ?? "Welcome to summer camp!",
          date: (camps[0] as { start_date: string | null }).start_date,
        },
      ]
    : []

  const events = camps[0]
    ? [
        {
          id: 1,
          title: "Camp kickoff",
          date: (camps[0] as { start_date: string | null }).start_date,
          type: "workshop",
        },
        {
          id: 2,
          title: "Final showcase",
          date: (camps[0] as { end_date: string | null }).end_date,
          type: "deadline",
        },
      ]
    : []

  const primaryTrainingId = enrollments[0]?.training_id
  let leaderboard_rank: number | null = null
  let leaderboard_total: number | null = null
  if (primaryTrainingId != null) {
    const board = await buildTrainingLeaderboard(studentDbId, primaryTrainingId)
    leaderboard_rank = board.current_user?.rank ?? null
    leaderboard_total = board.leaderboard.length
  }

  return {
    overall_percent: overallPercent,
    enrollments: await getEnrollments(studentDbId),
    progress,
    upcoming_checkpoints: upcomingCheckpoints,
    recent_feedback: recentFeedback,
    recent_discussions: recentDiscussions,
    announcements,
    upcoming_events: events,
    total_xp: xpState.total_xp,
    modules_completed: xpState.modules_completed,
    leaderboard_rank,
    leaderboard_total,
  }
}

export async function hubMyTrainings(studentDbId: number) {
  const enrollments = (await getEnrollments(studentDbId)) as Array<{
    training_id: number
    training_title: string
    training_slug: string
    camp_title: string
    status: string
    enrolled_at: string
  }>

  const items = []
  for (const en of enrollments) {
    const prog = await getTrainingProgress(studentDbId, en.training_id)
    const faculty = await getFacultyForTraining(en.training_id)
    const meta = getTrainingMeta(en.training_slug)
    items.push({
      ...en,
      ...prog,
      faculty,
      meta,
      completion_status:
        prog.percent >= 100 ? "completed" : prog.percent > 0 ? "in_progress" : "not_started",
    })
  }
  return { trainings: items }
}

export async function hubBrowse(studentDbId?: number | null) {
  const enrolledTrainingIds = new Set<number>()
  if (studentDbId != null) {
    const enrollmentRows = await sql`
      SELECT training_id FROM camp_enrollments
      WHERE student_id = ${studentDbId} AND status = 'active'
    `
    for (const row of enrollmentRows as Array<{ training_id: number }>) {
      enrolledTrainingIds.add(Number(row.training_id))
    }
  }

  const camps = await sql`
    SELECT id, slug, title, description, start_date, end_date, status
    FROM summer_camps
    WHERE status IN ('published', 'active')
    ORDER BY start_date DESC NULLS LAST
  `

  const publishedSlugs = new Set<string>()
  const result = []

  for (const camp of camps as Array<{ id: number; slug: string; title: string }>) {
    const trainings = (await sql`
      SELECT t.id, t.slug, t.title, t.description, t.status
      FROM camp_trainings t
      WHERE t.camp_id = ${camp.id} AND t.status = 'published'
      ORDER BY t.sort_order ASC, t.title ASC
    `) as Array<{ id: number; slug: string; title: string; description: string | null }>

    const enriched = []
    for (const t of trainings) {
      publishedSlugs.add(t.slug)
      const faculty = await getFacultyForTraining(t.id)
      enriched.push({
        ...t,
        meta: getTrainingMeta(t.slug),
        faculty,
        available: true,
        enrolled: enrolledTrainingIds.has(t.id),
      })
    }

    for (const [slug, meta] of Object.entries(TRAINING_CATALOG)) {
      if (!publishedSlugs.has(slug) && meta.comingSoon) {
        enriched.push({
          id: null,
          slug,
          title: meta.title,
          description: null,
          status: "coming_soon",
          meta,
          faculty: [],
          available: false,
        })
      }
    }

    result.push({ ...camp, trainings: enriched })
  }

  return { camps: result }
}

export async function hubRoadmap(studentDbId: number) {
  const enrollments = (await getEnrollments(studentDbId)) as Array<{
    training_id: number
    training_title: string
    training_slug: string
  }>

  const roadmaps = []
  for (const en of enrollments) {
    const prog = await getTrainingProgress(studentDbId, en.training_id)
    roadmaps.push({
      training_id: en.training_id,
      training_title: en.training_title,
      training_slug: en.training_slug,
      percent: prog.percent,
      milestones: prog.modules.map((m, i) => ({
        id: m.id,
        title: m.title,
        sort_order: m.sort_order,
        index: i + 1,
        status: m.is_complete ? "complete" : i === prog.completed_modules ? "current" : "upcoming",
        is_complete: m.is_complete,
      })),
    })
  }
  return { roadmaps }
}

export async function hubProjects(studentDbId: number) {
  const rows = await sql`
    SELECT
      p.id AS project_id,
      p.title AS project_title,
      p.description AS project_description,
      p.metadata AS project_metadata,
      p.sort_order AS project_sort_order,
      t.id AS training_id,
      t.title AS training_title,
      t.slug AS training_slug
    FROM camp_projects p
    JOIN camp_trainings t ON t.id = p.training_id
    JOIN camp_enrollments e ON e.training_id = t.id AND e.student_id = ${studentDbId}
    WHERE COALESCE(p.metadata->>'kind', '') IN ('capstone', 'team_capstone')
      AND (
        NULLIF(p.metadata->>'assigned_student_id', '') IS NULL
        OR (p.metadata->>'assigned_student_id')::int = ${studentDbId}
      )
    ORDER BY p.sort_order ASC, p.title ASC
  `

  const projects = []
  for (const row of rows as Array<{
    project_id: number
    project_title: string
    project_description: string | null
    project_metadata: Record<string, unknown> | null
    project_sort_order: number
    training_id: number
    training_title: string
  }>) {
    const meta = (row.project_metadata ?? {}) as Record<string, unknown>
    const modules = (await sql`
      SELECT m.id, m.title, m.status
      FROM camp_modules m
      WHERE m.project_id = ${row.project_id} AND m.status = 'published'
      ORDER BY m.sort_order ASC
    `) as Array<{ id: number; title: string }>

    const completed = (await sql`
      SELECT module_id FROM camp_progress
      WHERE student_id = ${studentDbId}
        AND progress_type = 'module_complete'
        AND module_id IN (SELECT id FROM camp_modules WHERE project_id = ${row.project_id})
    `) as Array<{ module_id: number }>
    const doneSet = new Set(completed.map((c) => c.module_id))

    const stepsTotal = (await sql`
      SELECT COUNT(*)::int AS c FROM camp_module_blocks b
      JOIN camp_modules m ON m.id = b.module_id
      WHERE m.project_id = ${row.project_id} AND b.block_type IN ('step', 'activity')
    `) as Array<{ c: number }>

    const stepsDone = (await sql`
      SELECT COUNT(*)::int AS c FROM camp_progress pr
      JOIN camp_module_blocks b ON b.id = pr.block_id
      JOIN camp_modules m ON m.id = b.module_id
      WHERE pr.student_id = ${studentDbId}
        AND pr.progress_type = 'step_complete'
        AND m.project_id = ${row.project_id}
    `) as Array<{ c: number }>

    const checkpointsTotal = (await sql`
      SELECT COUNT(*)::int AS c FROM camp_module_blocks b
      JOIN camp_modules m ON m.id = b.module_id
      WHERE m.project_id = ${row.project_id} AND b.block_type = 'checkpoint'
    `) as Array<{ c: number }>

    const checkpointsPassed = (await sql`
      SELECT COUNT(DISTINCT s.block_id)::int AS c FROM camp_submissions s
      JOIN camp_module_blocks b ON b.id = s.block_id
      JOIN camp_modules m ON m.id = s.module_id
      WHERE s.student_id = ${studentDbId}
        AND m.project_id = ${row.project_id}
        AND s.status IN ('submitted', 'approved', 'reviewed')
    `) as Array<{ c: number }>

    const faculty = await getFacultyForTraining(row.training_id)
    const curriculum = await getCurriculumProgress(row.training_id, studentDbId)
    const unlocked = curriculum.complete
    const deliverables = modules.length
    const done = modules.filter((m) => doneSet.has(m.id)).length
    const status =
      done >= deliverables && deliverables > 0
        ? "completed"
        : done > 0 || (stepsDone[0]?.c ?? 0) > 0
          ? "in_progress"
          : "not_started"

    const primaryModuleId = modules[0]?.id ?? null

    const assignedStudent = meta.assigned_student as Record<string, unknown> | null | undefined

    projects.push({
      ...row,
      mentor: faculty[0]?.name ?? null,
      assigned_student_name: assignedStudent?.full_name ? String(assignedStudent.full_name) : null,
      assigned_student_university: assignedStudent?.university ? String(assignedStudent.university) : null,
      project_number: meta.project_number != null ? Number(meta.project_number) : null,
      project_kind: String(meta.kind ?? "capstone"),
      deliverables: modules.map((m) => ({
        id: m.id,
        title: m.title,
        is_complete: doneSet.has(m.id),
      })),
      status,
      progress_percent: deliverables > 0 ? Math.round((done / deliverables) * 100) : 0,
      due_date: null,
      primary_module_id: primaryModuleId,
      difficulty: String(meta.difficulty ?? "medium"),
      required: Boolean(meta.required),
      estimated_hours: String(meta.estimated_hours ?? ""),
      badge: String(meta.badge ?? ""),
      xp_reward: Number(meta.xp_reward ?? 0),
      overview: String(meta.overview ?? row.project_description ?? ""),
      learning_outcomes: Array.isArray(meta.learning_outcomes) ? meta.learning_outcomes : [],
      tasks_completed: stepsDone[0]?.c ?? 0,
      tasks_total: stepsTotal[0]?.c ?? 0,
      checkpoints_passed: checkpointsPassed[0]?.c ?? 0,
      checkpoints_total: checkpointsTotal[0]?.c ?? 0,
      unlocked,
      curriculum,
    })
  }

  return { projects }
}

export async function hubCheckpoints(studentDbId: number) {
  const pending = await sql`
    SELECT
      b.id AS block_id,
      b.content,
      m.id AS module_id,
      m.title AS module_title,
      t.id AS training_id,
      t.title AS training_title
    FROM camp_module_blocks b
    JOIN camp_modules m ON m.id = b.module_id
    JOIN camp_projects p ON p.id = m.project_id
    JOIN camp_trainings t ON t.id = p.training_id
    JOIN camp_enrollments e ON e.training_id = t.id AND e.student_id = ${studentDbId}
    WHERE b.block_type = 'checkpoint'
      AND m.status = 'published'
      AND NOT EXISTS (
        SELECT 1 FROM camp_submissions s
        WHERE s.student_id = ${studentDbId} AND s.block_id = b.id
          AND s.status IN ('submitted', 'approved', 'reviewed')
      )
    ORDER BY m.sort_order ASC, b.sort_order ASC
  `

  const approved = await sql`
    SELECT
      s.id AS submission_id,
      s.status,
      s.file_name,
      s.reviewed_at,
      b.id AS block_id,
      b.content,
      m.id AS module_id,
      m.title AS module_title,
      t.title AS training_title
    FROM camp_submissions s
    JOIN camp_module_blocks b ON b.id = s.block_id
    JOIN camp_modules m ON m.id = s.module_id
    JOIN camp_projects p ON p.id = m.project_id
    JOIN camp_trainings t ON t.id = p.training_id
    WHERE s.student_id = ${studentDbId}
      AND s.status IN ('approved', 'reviewed')
    ORDER BY s.reviewed_at DESC NULLS LAST
  `

  return { pending, approved }
}

export async function hubDiscussions(studentDbId: number) {
  const myQuestions = await sql`
    SELECT
      d.id, d.title, d.body, d.status, d.created_at, d.updated_at,
      m.id AS module_id, m.title AS module_title,
      t.title AS training_title
    FROM camp_discussions d
    JOIN camp_modules m ON m.id = d.module_id
    JOIN camp_projects p ON p.id = m.project_id
    JOIN camp_trainings t ON t.id = p.training_id
    WHERE d.student_id = ${studentDbId} AND d.parent_id IS NULL
    ORDER BY d.updated_at DESC
  `

  const trainingDiscussions = await sql`
    SELECT
      d.id, d.title, d.body, d.status, d.updated_at,
      m.title AS module_title,
      t.title AS training_title,
      CASE WHEN d.student_id = ${studentDbId} THEN true ELSE false END AS is_mine
    FROM camp_discussions d
    JOIN camp_modules m ON m.id = d.module_id
    JOIN camp_projects p ON p.id = m.project_id
    JOIN camp_trainings t ON t.id = p.training_id
    JOIN camp_enrollments e ON e.training_id = t.id AND e.student_id = ${studentDbId}
    WHERE d.parent_id IS NULL
    ORDER BY d.updated_at DESC
    LIMIT 30
  `

  const resolved = (myQuestions as Array<{ status: string }>).filter(
    (q) => q.status === "resolved" || q.status === "closed",
  )

  const announcements = await sql`
    SELECT id, title, description AS body, start_date AS date
    FROM summer_camps
    WHERE status IN ('published', 'active')
    ORDER BY start_date DESC NULLS LAST
    LIMIT 5
  `

  return {
    my_questions: myQuestions,
    training_discussions: trainingDiscussions,
    instructor_announcements: announcements,
    resolved_questions: resolved,
  }
}

export async function hubResources(studentDbId: number) {
  const blocks = await sql`
    SELECT
      b.id,
      b.block_type,
      b.content,
      m.id AS module_id,
      m.title AS module_title,
      p.title AS project_title,
      t.id AS training_id,
      t.title AS training_title
    FROM camp_module_blocks b
    JOIN camp_modules m ON m.id = b.module_id
    JOIN camp_projects p ON p.id = m.project_id
    JOIN camp_trainings t ON t.id = p.training_id
    JOIN camp_enrollments e ON e.training_id = t.id AND e.student_id = ${studentDbId}
    WHERE b.block_type IN ('pdf', 'video', 'code', 'text', 'image_gallery')
      AND m.status = 'published'
    ORDER BY t.title ASC, m.sort_order ASC, b.sort_order ASC
  `

  const byTraining: Record<
    string,
    {
      training_id: number
      training_title: string
      resources: Array<{
        id: number
        type: string
        title: string
        module_title: string
        url?: string
        description?: string
      }>
    }
  > = {}

  for (const b of blocks as Array<{
    id: number
    block_type: string
    content: Record<string, unknown>
    module_title: string
    training_id: number
    training_title: string
  }>) {
    const key = b.training_title
    if (!byTraining[key]) {
      byTraining[key] = {
        training_id: b.training_id,
        training_title: b.training_title,
        resources: [],
      }
    }
    const content = b.content ?? {}
    byTraining[key].resources.push({
      id: b.id,
      type: b.block_type,
      title: String(content.title ?? content.label ?? b.module_title),
      module_title: b.module_title,
      url: (content.url ?? content.src ?? content.href) as string | undefined,
      description: (content.description ?? content.text) as string | undefined,
    })
  }

  return { trainings: Object.values(byTraining) }
}

async function buildTrainingLeaderboard(studentDbId: number, trainingId: number) {
  const campers = (await sql`
    SELECT s.id AS student_id, s.full_name
    FROM camp_enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE e.training_id = ${trainingId} AND e.status = 'active'
  `) as Array<{ student_id: number; full_name: string }>

  const progressRows = (await sql`
    SELECT cp.student_id, m.sort_order
    FROM camp_progress cp
    JOIN camp_modules m ON m.id = cp.module_id
    JOIN camp_projects pr ON pr.id = m.project_id
    WHERE cp.progress_type = 'module_complete'
      AND pr.training_id = ${trainingId}
  `) as Array<{ student_id: number; sort_order: number }>

  const xpByStudent = new Map<number, number>()
  const modulesByStudent = new Map<number, number>()
  await Promise.all(
    campers.map(async (c) => {
      const sid = Number(c.student_id)
      xpByStudent.set(sid, await computeCampXpFromProgress(sid, trainingId))
    }),
  )
  for (const row of progressRows) {
    const sid = Number(row.student_id)
    modulesByStudent.set(sid, (modulesByStudent.get(sid) ?? 0) + 1)
  }

  const badgesByStudent = new Map<number, number>()
  if (campers.length > 0) {
    const camperIds = campers.map((c) => Number(c.student_id))
    const badgeRows = (await sql`
      SELECT student_id, badges FROM camp_camper_profiles
      WHERE student_id = ANY(${camperIds}::int[])
    `) as Array<{ student_id: number; badges: string[] }>
    for (const row of badgeRows) {
      badgesByStudent.set(
        Number(row.student_id),
        Array.isArray(row.badges) ? row.badges.length : 0,
      )
    }
  }

  const leaderboard = campers
    .map((c) => {
      const sid = Number(c.student_id)
      return {
        student_id: sid,
        name: formatCampDisplayName(String(c.full_name)),
        total_xp: xpByStudent.get(sid) ?? 0,
        modules_completed: modulesByStudent.get(sid) ?? 0,
        badges_earned: badgesByStudent.get(sid) ?? 0,
        is_current_user: sid === studentDbId,
      }
    })
    .sort((a, b) => b.total_xp - a.total_xp || b.modules_completed - a.modules_completed)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))

  const current_user = leaderboard.find((e) => e.is_current_user) ?? null
  return { leaderboard, current_user }
}

export async function hubLeaderboard(studentDbId: number, trainingIdParam?: number) {
  await syncCampCamperXp(studentDbId)
  const enrollments = (await getEnrollments(studentDbId)) as Array<{
    training_id: number
    training_title: string
  }>

  const selectedTrainingId =
    trainingIdParam != null && enrollments.some((e) => e.training_id === trainingIdParam)
      ? trainingIdParam
      : enrollments[0]?.training_id

  if (selectedTrainingId == null) {
    return {
      trainings: [],
      selected_training_id: null,
      leaderboard: [],
      current_user: null,
      total_xp: 0,
    }
  }

  const board = await buildTrainingLeaderboard(studentDbId, selectedTrainingId)
  const total_xp = await computeCampXpFromProgress(studentDbId)

  return {
    trainings: enrollments.map((e) => ({ id: e.training_id, title: e.training_title })),
    selected_training_id: selectedTrainingId,
    leaderboard: board.leaderboard,
    current_user: board.current_user,
    total_xp,
  }
}

export async function hubAchievements(studentDbId: number) {
  const xpState = await syncCampCamperXp(studentDbId)
  const enrollments = (await getEnrollments(studentDbId)) as Array<{
    training_id: number
    training_slug: string
  }>
  let totalModules = 0
  let completedModules = 0
  const completedTitles: string[] = []

  for (const en of enrollments) {
    const prog = await getTrainingProgress(studentDbId, en.training_id)
    totalModules += prog.total_modules
    completedModules += prog.completed_modules
    for (const m of prog.modules) {
      if (m.is_complete) completedTitles.push(m.title.toLowerCase())
    }
  }

  const profileRows = await sql`
    SELECT badges, total_xp FROM camp_camper_profiles WHERE student_id = ${studentDbId} LIMIT 1
  `
  const profileBadges = (profileRows[0]?.badges as string[]) ?? []
  const totalXp = xpState.total_xp

  const badges: Array<{ id: string; title: string; emoji: string; earned: boolean; description: string }> = [
    {
      id: "welcome-badge",
      title: "Welcome Badge",
      emoji: "👋",
      earned: profileBadges.includes("welcome-badge") || completedTitles.some((t) => t.includes("welcome")),
      description: "Complete Module 0 onboarding",
    },
    {
      id: "camp-explorer",
      title: "Camp Explorer",
      emoji: "🧭",
      earned: profileBadges.includes("camp-explorer"),
      description: "Start your AI & Edge mission",
    },
    {
      id: "first-discussion",
      title: "First Discussion",
      emoji: "💬",
      earned: profileBadges.includes("first-discussion"),
      description: "Post your first camp discussion",
    },
    {
      id: "ai-explorer",
      title: "AI Explorer",
      emoji: "🧠",
      earned: profileBadges.includes("ai-explorer") || completedTitles.some((t) => t.includes("artificial intelligence")),
      description: "Complete Module 1 — What is Artificial Intelligence?",
    },
    {
      id: "ml-explorer",
      title: "Machine Learning Explorer",
      emoji: "📊",
      earned: profileBadges.includes("ml-explorer") || completedTitles.some((t) => t.includes("machine learning")),
      description: "Complete Module 2 — Machine Learning and Deep Learning",
    },
    {
      id: "cv-explorer",
      title: "Computer Vision Explorer",
      emoji: "👁️",
      earned: profileBadges.includes("cv-explorer") || completedTitles.some((t) => t.includes("computer vision")),
      description: "Complete Module 3 — Computer Vision & Image Understanding",
    },
    {
      id: "iot-explorer",
      title: "IoT Explorer",
      emoji: "📡",
      earned: profileBadges.includes("iot-explorer") || completedTitles.some((t) => t.includes("internet of things") || t.includes("(iot)")),
      description: "Complete Module 4 — Internet of Things (IoT)",
    },
    {
      id: "edge-explorer",
      title: "Edge Computing Explorer",
      emoji: "⚡",
      earned: profileBadges.includes("edge-explorer") || completedTitles.some((t) => t.includes("edge computing")),
      description: "Complete Module 5 — Edge Computing",
    },
    {
      id: "edge-ai-explorer",
      title: "Edge AI Explorer",
      emoji: "🤖",
      earned: profileBadges.includes("edge-ai-explorer") || completedTitles.some((t) => t.includes("ai at the edge")),
      description: "Complete Module 6 — AI at the Edge",
    },
    {
      id: "first-module",
      title: "First Module Complete",
      emoji: "🏅",
      earned: completedModules >= 1 || profileBadges.includes("first-module"),
      description: "Finish your first camp module",
    },
    {
      id: "pi-explorer",
      title: "Raspberry Pi Explorer",
      emoji: "🥧",
      earned: profileBadges.includes("pi-explorer") || completedTitles.some((t) => t.includes("meet the raspberry pi")),
      description: "Complete Module 7 — Meet the Raspberry Pi",
    },
    {
      id: "edge-device-builder",
      title: "Edge Device Builder",
      emoji: "🔧",
      earned: profileBadges.includes("edge-device-builder") || completedTitles.some((t) => t.includes("setting up your raspberry pi")),
      description: "Complete Module 8 — Setting Up Your Raspberry Pi",
    },
    {
      id: "hardware-setup-cert",
      title: "Hardware Setup Certificate",
      emoji: "📜",
      earned: profileBadges.includes("hardware-setup-cert"),
      description: "Successfully assembled and configured your Edge AI device",
    },
    {
      id: "opencv-explorer",
      title: "Computer Vision Explorer",
      emoji: "👁️",
      earned:
        profileBadges.includes("opencv-explorer") ||
        completedTitles.some((t) => t.includes("opencv") || t.includes("computer vision environment")),
      description: "Complete Module 9 — OpenCV Setup & Computer Vision Environment",
    },
    {
      id: "edge-vision-explorer",
      title: "Edge Vision Explorer",
      emoji: "🎯",
      earned:
        profileBadges.includes("edge-vision-explorer") ||
        profileBadges.includes("edge-ai-deployment-explorer") ||
        completedTitles.some((t) => t.includes("face") && t.includes("eye")),
      description: "Complete Module 10 — Running Your First Face & Eye Detection System",
    },
    {
      id: "first-cv-deployment-cert",
      title: "First Computer Vision Deployment Certificate",
      emoji: "🚀",
      earned:
        profileBadges.includes("first-cv-deployment-cert") ||
        profileBadges.includes("first-edge-ai-deployment-cert"),
      description: "Successfully deployed your first face & eye detection system",
    },
    {
      id: "edge-ai-deployment-explorer",
      title: "Edge AI Explorer",
      emoji: "🎯",
      earned:
        profileBadges.includes("edge-ai-deployment-explorer") ||
        completedTitles.some((t) => t.includes("first object detection") || t.includes("object detection system")),
      description: "Legacy badge — Module 10 object detection track",
    },
    {
      id: "first-edge-ai-deployment-cert",
      title: "First Edge AI Deployment Certificate",
      emoji: "🚀",
      earned: profileBadges.includes("first-edge-ai-deployment-cert"),
      description: "Legacy certificate — first Edge AI deployment",
    },
    {
      id: "detection-specialist",
      title: "Object Detection Specialist",
      emoji: "🔬",
      earned: profileBadges.includes("detection-specialist") || completedTitles.some((t) => t.includes("customizing and improving")),
      description: "Complete object detection customization module",
    },
    {
      id: "edge-ai-engineer",
      title: "Edge AI Engineer",
      emoji: "⚙️",
      earned: profileBadges.includes("edge-ai-engineer") || completedTitles.some((t) => t.includes("final project showcase")),
      description: "Complete the Final Project Showcase and earn your Edge AI Engineer badge",
    },
    {
      id: "camp-certificate-2026",
      title: "AI & Edge Computing Summer Camp Certificate",
      emoji: "🏆",
      earned: profileBadges.includes("camp-certificate-2026"),
      description: "Official camp certificate — Prairie View A&M University CREDIT Center",
    },
    {
      id: "xr-explorer",
      title: "XR Explorer",
      emoji: "🥽",
      earned: profileBadges.includes("xr-explorer"),
      description: "Participate in the Module 1 XR discussion",
    },
    {
      id: "xr-foundations",
      title: "XR Foundations",
      emoji: "🌐",
      earned: profileBadges.includes("xr-foundations") || completedTitles.some((t) => t.includes("introduction to extended reality")),
      description: "Complete Module 1 — Introduction to Extended Reality (XR)",
    },
    {
      id: "research-explorer",
      title: "Research Explorer",
      emoji: "🔬",
      earned: profileBadges.includes("research-explorer"),
      description: "Preview the summer VR attention research project",
    },
    {
      id: "attention-scientist",
      title: "Attention Scientist",
      emoji: "👁️",
      earned: profileBadges.includes("attention-scientist") || completedTitles.some((t) => t.includes("human vision, attention")),
      description: "Complete Module 2 — Human Vision, Attention, and Eye Tracking Fundamentals",
    },
    {
      id: "human-factors-explorer",
      title: "Human Factors Explorer",
      emoji: "🧠",
      earned: profileBadges.includes("human-factors-explorer"),
      description: "Explore fixation, saccade, and gaze metrics for VR research",
    },
    {
      id: "htc-vive-pro-eye-operator",
      title: "HTC Vive Pro Eye Operator",
      emoji: "🥽",
      earned: profileBadges.includes("htc-vive-pro-eye-operator") || completedTitles.some((t) => t.includes("htc vive pro eye hardware")),
      description: "Complete Module 3 — Eye Tracking Systems and HTC Vive Pro Eye Hardware",
    },
    {
      id: "xr-lab-technician",
      title: "XR Lab Technician",
      emoji: "🔧",
      earned: profileBadges.includes("xr-lab-technician"),
      description: "Set up, calibrate, and validate the Vive Pro Eye research platform",
    },
    {
      id: "xr-data-scientist",
      title: "XR Data Scientist",
      emoji: "📊",
      earned: profileBadges.includes("xr-data-scientist") || completedTitles.some((t) => t.includes("multimodal tracking")),
      description: "Complete Module 4 — Multimodal Tracking and Data Collection in XR",
    },
    {
      id: "multimodal-researcher",
      title: "Multimodal Researcher",
      emoji: "🔬",
      earned: profileBadges.includes("multimodal-researcher"),
      description: "Design synchronized behavioral datasets for XR research",
    },
    {
      id: "unity-xr-developer",
      title: "Unity XR Developer",
      emoji: "🎮",
      earned: profileBadges.includes("unity-xr-developer") || completedTitles.some((t) => t.includes("unity xr development")),
      description: "Complete Module 5 — Unity XR Development Environment",
    },
    {
      id: "virtual-environment-builder",
      title: "Virtual Environment Builder",
      emoji: "🏫",
      earned: profileBadges.includes("virtual-environment-builder"),
      description: "Build a functioning Unity XR research scene with gaze tracking",
    },
    {
      id: "xr-learning-designer",
      title: "XR Learning Designer",
      emoji: "📐",
      earned: profileBadges.includes("xr-learning-designer") || completedTitles.some((t) => t.includes("educational vr experiences")),
      description: "Complete Module 6 — Building Educational VR Experiences and Experimental Design",
    },
    {
      id: "educational-researcher",
      title: "Educational Researcher",
      emoji: "🎓",
      earned: profileBadges.includes("educational-researcher"),
      description: "Design pilot studies and experimental protocols for VR learning research",
    },
    {
      id: "educational-xr-designer",
      title: "Educational XR Designer",
      emoji: "🏆",
      earned: profileBadges.includes("educational-xr-designer") || completedTitles.some((t) => t.includes("building educational vr experiences")),
      description: "Complete Module 7 — Building Educational VR Experiences",
    },
    {
      id: "virtual-classroom-builder",
      title: "Virtual Classroom Builder",
      emoji: "🏫",
      earned: profileBadges.includes("virtual-classroom-builder"),
      description: "Build your first complete educational VR lesson",
    },
    {
      id: "xr-analytics-explorer",
      title: "XR Analytics Explorer",
      emoji: "📈",
      earned: profileBadges.includes("xr-analytics-explorer") || completedTitles.some((t) => t.includes("data analysis and visualization")),
      description: "Complete Module 8 — Data Analysis and Visualization",
    },
    {
      id: "data-visualization-specialist",
      title: "Data Visualization Specialist",
      emoji: "📊",
      earned: profileBadges.includes("data-visualization-specialist"),
      description: "Create research-quality heatmaps and visualizations from gaze data",
    },
    {
      id: "data-analyst",
      title: "Data Analyst",
      emoji: "🔍",
      earned: profileBadges.includes("data-analyst"),
      description: "Analyze XR datasets and interpret behavioral patterns",
    },
    {
      id: "ai-researcher",
      title: "AI Researcher",
      emoji: "🤖",
      earned: profileBadges.includes("ai-researcher") || completedTitles.some((t) => t.includes("ai for attention analysis")),
      description: "Complete Module 9 — AI for Attention Analysis",
    },
    {
      id: "behavioral-analytics-specialist",
      title: "Behavioral Analytics Specialist",
      emoji: "🧠",
      earned: profileBadges.includes("behavioral-analytics-specialist"),
      description: "Build and evaluate attention prediction models from XR data",
    },
    {
      id: "attention-ai-specialist",
      title: "Attention AI Specialist",
      emoji: "🏆",
      earned: profileBadges.includes("attention-ai-specialist"),
      description: "Apply AI thoughtfully to adaptive learning and attention interventions",
    },
    {
      id: "summer-research-scholar",
      title: "Summer Research Scholar",
      emoji: "🎓",
      earned: profileBadges.includes("summer-research-scholar") || completedTitles.some((t) => t.includes("research methods and publication")),
      description: "Complete Module 10 and final research deliverables",
    },
    {
      id: "xr-researcher",
      title: "XR Researcher",
      emoji: "🔬",
      earned: profileBadges.includes("xr-researcher"),
      description: "Complete the XR Attention Analytics research training program",
    },
    {
      id: "scientific-communicator",
      title: "Scientific Communicator",
      emoji: "🎨",
      earned: profileBadges.includes("scientific-communicator"),
      description: "Design research posters and publication-quality figures",
    },
    {
      id: "research-author",
      title: "Research Author",
      emoji: "📚",
      earned: profileBadges.includes("research-author"),
      description: "Draft conference papers and scientific writing",
    },
    {
      id: "research-thinker",
      title: "Research Thinker",
      emoji: "🧠",
      earned: profileBadges.includes("research-thinker"),
      description: "Formulate testable hypotheses for XR research",
    },
    {
      id: "eye-tracking-analytics-researcher",
      title: "Eye Tracking Analytics Researcher",
      emoji: "👁️",
      earned: profileBadges.includes("eye-tracking-analytics-researcher"),
      description: "Complete Project 1 — Visual Attention Analytics in VR",
    },
    {
      id: "ai-attention-modeling-researcher",
      title: "AI Attention Modeling Researcher",
      emoji: "🧠",
      earned: profileBadges.includes("ai-attention-modeling-researcher"),
      description: "Complete Project 2 — AI-Based Attention Prediction",
    },
    {
      id: "human-factors-researcher",
      title: "Human Factors Researcher",
      emoji: "📋",
      earned: profileBadges.includes("human-factors-researcher"),
      description: "Complete Project 3 — Human Factors Analysis of VR Learning",
    },
    {
      id: "xr-research-capstone-scholar",
      title: "XR Research Capstone Scholar",
      emoji: "🏆",
      earned: profileBadges.includes("xr-research-capstone-scholar"),
      description: "Complete the VR Attention Research Capstone project",
    },
    {
      id: "xr-attention-certificate-2026",
      title: "XR Attention Analytics Certificate",
      emoji: "📜",
      earned: profileBadges.includes("xr-attention-certificate-2026"),
      description: "Certificate in AI, VR, Eye-Tracking, and Behavioral Analytics Research — PVAMU ECE · Central State University",
    },
    {
      id: "attention-intelligence",
      title: "Attention Intelligence",
      emoji: "🎯",
      earned: profileBadges.includes("attention-intelligence"),
      description: "Transform multimodal XR data into attention insights with AI",
    },
    {
      id: "graduate",
      title: "Summer Camp Graduate",
      emoji: "🎓",
      earned: totalModules > 0 && completedModules >= totalModules || profileBadges.includes("camp-certificate-2026"),
      description: "Complete all modules in your enrolled trainings",
    },
  ]

  const certRows = await sql`
    SELECT c.id, c.verification_code, c.linkedin_share_url, c.issued_at, c.camp_title,
           t.slug AS training_slug, t.title AS training_title
    FROM camp_certificates c
    JOIN camp_trainings t ON t.id = c.training_id
    WHERE c.student_id = ${studentDbId}
    ORDER BY c.issued_at DESC
  `
  const certificates = (certRows as Array<{
    id: number
    verification_code: string
    linkedin_share_url: string | null
    issued_at: string
    camp_title: string
    training_slug: string
    training_title: string
  }>).map((c) => ({
    id: c.id,
    title: getCertificateDisplayTitle(c.training_slug),
    issuer: getCertificateIssuerLine(c.training_slug),
    available: true,
    verification_code: c.verification_code,
    linkedin_share_url: c.linkedin_share_url,
    issued_at: c.issued_at,
  }))

  if (
    certificates.length === 0 &&
    (profileBadges.includes("camp-certificate-2026") ||
      profileBadges.includes(XR_ATTENTION_CERTIFICATE_TYPE) ||
      badges.find((b) => b.id === "graduate" && b.earned))
  ) {
    const xrEnrolled = enrollments.some((e) => e.training_slug === XR_ATTENTION_TRAINING_SLUG)
    const slug = xrEnrolled ? XR_ATTENTION_TRAINING_SLUG : "ai-edge-computing"
    certificates.push({
      id: 0,
      title: getCertificateDisplayTitle(slug),
      issuer: getCertificateIssuerLine(slug),
      available: false,
      verification_code: null,
      linkedin_share_url: null,
      issued_at: null,
    })
  }

  return {
    badges,
    certificates,
    stats: {
      modules_completed: completedModules,
      modules_total: totalModules,
      badges_earned: badges.filter((b) => b.earned).length,
      total_xp: totalXp,
    },
  }
}

export async function hubCalendar(studentDbId: number) {
  const dash = await hubDashboard(studentDbId)
  return {
    events: dash.upcoming_events,
    camps: (dash.enrollments as Array<{ camp_title: string }>).map((e) => e.camp_title),
  }
}

export async function hubAnnouncements(studentDbId: number) {
  const dash = await hubDashboard(studentDbId)
  return { announcements: dash.announcements }
}

export function hubSupport() {
  return {
    contacts: [
      { type: "email", label: "Camp Coordinator", value: "dmdoe@pvamu.edu" },
    ],
    links: [
      { label: "Discussions & Help", path: "/student/dashboard-v2/summer-camp/discussions" },
      { label: "Learning Roadmap", path: "/student/dashboard-v2/summer-camp/roadmap" },
    ],
  }
}
