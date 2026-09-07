/**
 * Reusable server-side Course Clone Service.
 * Copies teaching content only — never student records, attempts, grades, or enrollments.
 */
import { sql } from "@/lib/db"
import {
  persistNormalizedQuizQuestionsForQuiz,
  persistNormalizedSamplePracticeForLecture,
} from "@/lib/exchange-content-persist-normalize"
import { persistNormalizedQuestionBankRow } from "@/lib/question-bank-persist-normalize"
import {
  assessmentTypesForModules,
  modulesInclude,
  questionBankRequired,
} from "@/lib/course-exchange/modules"
import type {
  CloneCourseContentInput,
  CloneCourseContentResult,
  CloneIdMaps,
  CourseExchangeModule,
} from "@/lib/course-exchange/types"
import {
  filterGroupsProjectsForOwnSession,
  ownGroupsProjectsSessionMessage,
} from "@/lib/course-exchange/groups-projects-session-policy"
import { cloneClassroomPointAssignmentsToCourse } from "@/lib/clone-classroom-point-assignments"
import {
  buildDestinationReuseMaps,
  mergeReuseMaps,
  emptyReuseMaps,
  lectureExchangeMatchKey,
} from "@/lib/course-exchange/lineage-snapshot"
import { getGroupsProjectsCourseIdColumns } from "@/lib/instructor-default-courses"
import {
  dedupeElegSharedLectureRows,
  type LectureRowLike,
} from "@/lib/lecture-index-label"

function emptyMaps(): CloneIdMaps {
  return {
    questionBank: new Map(),
    quizzes: new Map(),
    lectures: new Map(),
    flashcardDecks: new Map(),
    groups: new Map(),
    playgroundSessions: new Map(),
    courseNotes: new Map(),
  }
}

async function destRowExists(table: "lectures" | "question_bank" | "quizzes" | "flashcard_decks" | "course_digital_notes" | "playground_sessions", destId: number, destCourseId: number): Promise<boolean> {
  if (table === "lectures") {
    const rows = (await sql`SELECT 1 FROM lectures WHERE id = ${destId} AND course_id = ${destCourseId} AND deleted_at IS NULL LIMIT 1`) as unknown[]
    return rows.length > 0
  }
  if (table === "question_bank") {
    const rows = (await sql`SELECT 1 FROM question_bank WHERE id = ${destId} AND course_id = ${destCourseId} AND deleted_at IS NULL LIMIT 1`) as unknown[]
    return rows.length > 0
  }
  if (table === "quizzes") {
    const rows = (await sql`SELECT 1 FROM quizzes WHERE id = ${destId} AND course_id = ${destCourseId} AND deleted_at IS NULL LIMIT 1`) as unknown[]
    return rows.length > 0
  }
  if (table === "flashcard_decks") {
    const rows = (await sql`SELECT 1 FROM flashcard_decks WHERE id = ${destId} AND course_id = ${destCourseId} AND deleted_at IS NULL LIMIT 1`) as unknown[]
    return rows.length > 0
  }
  if (table === "course_digital_notes") {
    const rows = (await sql`SELECT 1 FROM course_digital_notes WHERE id = ${destId} AND course_id = ${destCourseId} AND deleted_at IS NULL LIMIT 1`) as unknown[]
    return rows.length > 0
  }
  const rows = (await sql`SELECT 1 FROM playground_sessions WHERE id = ${destId} AND course_id = ${destCourseId} LIMIT 1`) as unknown[]
  return rows.length > 0
}

async function cloneQuestionBank(
  sourceCourseId: number,
  destCourseId: number,
  destInstructorId: number,
  map: Map<number, number>,
  reuseMaps?: CloneIdMaps | null,
): Promise<number> {
  const srcRows = (await sql`
    SELECT id FROM question_bank
    WHERE course_id = ${sourceCourseId} AND deleted_at IS NULL
    ORDER BY id
  `) as { id: number }[]

  let count = 0
  for (const { id: oldId } of srcRows) {
    const existingDest = reuseMaps?.questionBank.get(oldId)
    if (existingDest && (await destRowExists("question_bank", existingDest, destCourseId))) {
      map.set(oldId, existingDest)
      count += 1
      continue
    }
    const inserted = (await sql`
      INSERT INTO question_bank (
        question_text, question_type, difficulty, topic, options, correct_answer, hint,
        evaluation_mode, answer_guidelines, sample_answer, explanation, created_by,
        sample_answers, ai_expected_solution, max_points, anti_cheat_exempt, course_id,
        question_media, subquestions, solution_upload_config, solution_upload_required,
        grading_type, expected_answer
      )
      SELECT
        question_text, question_type, difficulty, topic, options, correct_answer, hint,
        evaluation_mode, answer_guidelines, sample_answer, explanation, ${destInstructorId},
        sample_answers, ai_expected_solution, max_points, anti_cheat_exempt, ${destCourseId},
        question_media, subquestions, solution_upload_config, solution_upload_required,
        grading_type, expected_answer
      FROM question_bank
      WHERE id = ${oldId}
      RETURNING id
    `) as { id: number }[]
    const newId = inserted[0].id
    await persistNormalizedQuestionBankRow(newId, destCourseId)
    map.set(oldId, newId)
    count += 1
  }
  return count
}

async function cloneSyllabus(
  sourceCourseId: number,
  destCourseId: number,
  destInstructorId: number,
  destinationSessionId?: number | null,
): Promise<number> {
  const srcRows = (await sql`
    SELECT title, term, sections, content_mode, pdf_url, pdf_file_name, logo_url, logo_file_name, session_id
    FROM course_syllabi
    WHERE course_id = ${sourceCourseId}
    ORDER BY (session_id IS NULL) DESC, id ASC
    LIMIT 1
  `) as {
    title: string
    term: string
    sections: unknown
    content_mode: string | null
    pdf_url: string | null
    pdf_file_name: string | null
    logo_url: string | null
    logo_file_name: string | null
    session_id: number | null
  }[]
  if (srcRows.length === 0) return 0

  const src = srcRows[0]
  const destSessionId =
    destinationSessionId != null && Number.isFinite(Number(destinationSessionId))
      ? Number(destinationSessionId)
      : null

  const existing = (await sql`
    SELECT id FROM course_syllabi
    WHERE course_id = ${destCourseId}
      AND session_id IS NOT DISTINCT FROM ${destSessionId}
    LIMIT 1
  `) as { id: number }[]

  if (existing.length > 0) {
    await sql`
      UPDATE course_syllabi
      SET title = ${src.title},
          term = ${src.term},
          status = 'draft',
          sections = ${JSON.stringify(src.sections ?? [])}::jsonb,
          content_mode = ${src.content_mode},
          pdf_url = ${src.pdf_url},
          pdf_file_name = ${src.pdf_file_name},
          logo_url = ${src.logo_url},
          logo_file_name = ${src.logo_file_name},
          published_at = NULL,
          updated_by = ${destInstructorId},
          updated_at = NOW()
      WHERE id = ${existing[0].id}
    `
    return 1
  }

  await sql`
    INSERT INTO course_syllabi (
      course_id, session_id, title, term, status, sections, created_by, updated_by,
      content_mode, pdf_url, pdf_file_name, logo_url, logo_file_name, published_at
    )
    VALUES (
      ${destCourseId},
      ${destSessionId},
      ${src.title},
      ${src.term},
      'draft',
      ${JSON.stringify(src.sections ?? [])}::jsonb,
      ${destInstructorId},
      ${destInstructorId},
      ${src.content_mode},
      ${src.pdf_url},
      ${src.pdf_file_name},
      ${src.logo_url},
      ${src.logo_file_name},
      NULL
    )
  `
  return 1
}

async function cloneLectures(
  sourceCourseId: number,
  destCourseId: number,
  destInstructorId: number,
  map: Map<number, number>,
  reuseMaps?: CloneIdMaps | null,
): Promise<number> {
  const srcRows = (await sql`
    SELECT id, week, title, course_id, session
    FROM lectures
    WHERE course_id = ${sourceCourseId} AND deleted_at IS NULL
    ORDER BY id
  `) as LectureRowLike[]

  const canonicalRows = dedupeElegSharedLectureRows(srcRows, sourceCourseId, null)
  const canonicalDestByKey = new Map<string, number>()

  let uniqueCount = 0
  for (const row of canonicalRows) {
    const oldLecId = row.id
    const cloneKey = lectureExchangeMatchKey(row.week, row.title)

    const existingDest = reuseMaps?.lectures.get(oldLecId)
    if (existingDest && (await destRowExists("lectures", existingDest, destCourseId))) {
      map.set(oldLecId, existingDest)
      canonicalDestByKey.set(cloneKey, existingDest)
      uniqueCount += 1
      continue
    }

    const reusedFromSameRun = canonicalDestByKey.get(cloneKey)
    if (reusedFromSameRun != null) {
      map.set(oldLecId, reusedFromSameRun)
      continue
    }

    const inserted = (await sql`
      INSERT INTO lectures (
        week, title, session, description, materials_url, professor_notes, lecture_summary,
        learning_objectives, is_published, created_by, session_access, course_id, section_id,
        original_file_url, original_file_type, pdf_url, thumbnail_url, content_mode,
        allow_download, sample_practice, lecture_workspace
      )
      SELECT
        week, title, session, description, materials_url, professor_notes, lecture_summary,
        learning_objectives, false, ${destInstructorId}, session_access, ${destCourseId}, NULL,
        original_file_url, original_file_type, pdf_url, thumbnail_url, content_mode,
        allow_download, sample_practice, lecture_workspace
      FROM lectures
      WHERE id = ${oldLecId}
      RETURNING id
    `) as { id: number }[]
    const newLecId = inserted[0].id
    map.set(oldLecId, newLecId)
    canonicalDestByKey.set(cloneKey, newLecId)
    await sql`
      INSERT INTO lecture_slides (
        lecture_id, content_type, title, content, file_url, slide_order, is_active,
        created_by, subtitle, background_gradient, ai_summary, ai_keywords
      )
      SELECT
        ${newLecId}, content_type, title, content, file_url, slide_order, is_active,
        ${destInstructorId}, subtitle, background_gradient, ai_summary, ai_keywords
      FROM lecture_slides
      WHERE lecture_id = ${oldLecId} AND deleted_at IS NULL
    `
    // Schema repair on first import only — skipped when reusing an existing destination lecture.
    await persistNormalizedSamplePracticeForLecture(newLecId, destCourseId)
    uniqueCount += 1
  }

  for (const row of srcRows) {
    if (map.has(row.id)) continue
    const cloneKey = lectureExchangeMatchKey(row.week, row.title)
    const destId = canonicalDestByKey.get(cloneKey)
    if (destId != null) map.set(row.id, destId)
  }

  return uniqueCount
}

async function cloneCourseNotes(
  sourceCourseId: number,
  destCourseId: number,
  destInstructorId: number,
  map: Map<number, number>,
  reuseMaps?: CloneIdMaps | null,
): Promise<number> {
  const srcNotes = (await sql`
    SELECT id FROM course_digital_notes
    WHERE course_id = ${sourceCourseId} AND deleted_at IS NULL
    ORDER BY id
  `) as { id: number }[]

  let count = 0
  for (const { id: oldId } of srcNotes) {
    const existingDest = reuseMaps?.courseNotes.get(oldId)
    if (existingDest && (await destRowExists("course_digital_notes", existingDest, destCourseId))) {
      map.set(oldId, existingDest)
      count += 1
      continue
    }
    const inserted = (await sql`
      INSERT INTO course_digital_notes (
        course_id, instructor_id, topic, title, body_text, ink_workspace, session, is_published
      )
      SELECT
        ${destCourseId}, ${destInstructorId}, topic, title, body_text, ink_workspace, session, false
      FROM course_digital_notes
      WHERE id = ${oldId} AND deleted_at IS NULL
      RETURNING id
    `) as { id: number }[]
    map.set(oldId, inserted[0].id)
    count += 1
  }
  return count
}

async function cloneFlashcards(
  sourceCourseId: number,
  destCourseId: number,
  destInstructorId: number,
  map: Map<number, number>,
  reuseMaps?: CloneIdMaps | null,
): Promise<number> {
  const srcDecks = (await sql`
    SELECT id FROM flashcard_decks
    WHERE course_id = ${sourceCourseId} AND deleted_at IS NULL AND student_id IS NULL
    ORDER BY id
  `) as { id: number }[]

  let count = 0
  for (const { id: oldDeckId } of srcDecks) {
    const existingDest = reuseMaps?.flashcardDecks.get(oldDeckId)
    if (existingDest && (await destRowExists("flashcard_decks", existingDest, destCourseId))) {
      map.set(oldDeckId, existingDest)
      count += 1
      continue
    }
    const inserted = (await sql`
      INSERT INTO flashcard_decks (
        title, description, deck_kind, course_id, session, instructor_id, topic,
        show_in_practice_hub, is_published, card_count, require_mcq_validation, cards_before_quiz
      )
      SELECT
        title, description, deck_kind, ${destCourseId}, session, ${destInstructorId}, topic,
        show_in_practice_hub, false, card_count, require_mcq_validation, cards_before_quiz
      FROM flashcard_decks
      WHERE id = ${oldDeckId}
      RETURNING id
    `) as { id: number }[]
    const newDeckId = inserted[0].id
    map.set(oldDeckId, newDeckId)
    await sql`
      INSERT INTO flashcard_cards (
        deck_id, front_text, back_text, sort_order, custom_distractors, difficulty
      )
      SELECT
        ${newDeckId}, front_text, back_text, sort_order, custom_distractors, difficulty
      FROM flashcard_cards
      WHERE deck_id = ${oldDeckId} AND deleted_at IS NULL
    `
    count += 1
  }
  return count
}

async function clonePracticeAvailability(
  sourceCourseId: number,
  questionMap: Map<number, number>,
  destinationSessionCode?: string | null,
): Promise<number> {
  if (questionMap.size === 0) return 0
  const oldIds = [...questionMap.keys()]
  const srcRows = (await sql`
    SELECT question_id, session, is_available, updated_by
    FROM practice_question_availability
    WHERE question_id = ANY(${oldIds}::int[])
  `) as { question_id: number; session: string; is_available: boolean; updated_by: number | null }[]

  let count = 0
  for (const row of srcRows) {
    const newQId = questionMap.get(row.question_id)
    if (!newQId) continue
    const session = destinationSessionCode?.trim() || row.session
    await sql`
      INSERT INTO practice_question_availability (question_id, session, is_available, updated_by, updated_at)
      VALUES (${newQId}, ${session}, ${row.is_available}, ${row.updated_by}, NOW())
      ON CONFLICT (question_id, session) DO UPDATE SET
        is_available = EXCLUDED.is_available,
        updated_at = NOW()
    `
    count += 1
  }
  return count
}

async function cloneAssessments(
  sourceCourseId: number,
  destCourseId: number,
  destInstructorId: number,
  assessmentTypes: string[],
  questionMap: Map<number, number>,
  quizMap: Map<number, number>,
  reuseMaps?: CloneIdMaps | null,
): Promise<number> {
  if (assessmentTypes.length === 0) return 0

  const srcQuizzes = (await sql`
    SELECT id, assessment_type
    FROM quizzes
    WHERE course_id = ${sourceCourseId}
      AND deleted_at IS NULL
      AND COALESCE(assessment_type, 'quiz') = ANY(${assessmentTypes}::text[])
    ORDER BY id
  `) as { id: number; assessment_type: string | null }[]

  let count = 0
  for (const { id: oldQuizId } of srcQuizzes) {
    const existingDest = reuseMaps?.quizzes.get(oldQuizId)
    if (existingDest && (await destRowExists("quizzes", existingDest, destCourseId))) {
      quizMap.set(oldQuizId, existingDest)
      count += 1
      continue
    }
    const inserted = (await sql`
      INSERT INTO quizzes (
        title, description, created_by, is_public, time_per_question, available_from, available_until,
        retake_enabled, retake_limit, review_before_retake, retake_policy, is_saved, assessment_type,
        parent_quiz_id, strict_mode_enabled, block_copy_paste, track_tab_switches, track_mouse_movement,
        warn_on_tab_switch, max_tab_switches, auto_submit_on_violations, beta_only, feature_flags,
        coverage, max_concurrent_students, track_gemini_window, max_gemini_strikes, geo_required,
        geo_lat, geo_lng, geo_radius_meters, rollover_enabled, rollover_hours, ai_evaluation_mode,
        require_fullscreen, forfeit_retake_on_report_view, section_config, keystroke_playback_enforced,
        enable_superpowers, allowed_superpowers, restrict_access_to_students, allowed_student_ids,
        access_restriction_session_id, code_language, lock_student_results_review, allowed_ai_code_languages,
        counts_toward_course_grade, course_id, ai_model, ai_model_by_task, ai_enable_opus_fallback,
        ai_opus_confidence_threshold
      )
      SELECT
        title, description, created_by, false, time_per_question, NULL, NULL,
        retake_enabled, retake_limit, review_before_retake, retake_policy, is_saved, assessment_type,
        NULL, strict_mode_enabled, block_copy_paste, track_tab_switches, track_mouse_movement,
        warn_on_tab_switch, max_tab_switches, auto_submit_on_violations, false, feature_flags,
        coverage, max_concurrent_students, track_gemini_window, max_gemini_strikes, false,
        NULL, NULL, NULL, rollover_enabled, rollover_hours, ai_evaluation_mode,
        require_fullscreen, forfeit_retake_on_report_view, section_config, keystroke_playback_enforced,
        enable_superpowers, allowed_superpowers, false, NULL,
        NULL, code_language, lock_student_results_review, allowed_ai_code_languages,
        counts_toward_course_grade, ${destCourseId}, ai_model, ai_model_by_task, ai_enable_opus_fallback,
        ai_opus_confidence_threshold
      FROM quizzes
      WHERE id = ${oldQuizId}
      RETURNING id
    `) as { id: number }[]
    const newQuizId = inserted[0].id
    quizMap.set(oldQuizId, newQuizId)

    const qqRows = (await sql`
      SELECT bank_question_id FROM quiz_questions WHERE quiz_id = ${oldQuizId}
    `) as { bank_question_id: number | null }[]

    await sql`
      INSERT INTO quiz_questions (
        quiz_id, question_text, question_type, option_a, option_b, option_c, option_d,
        correct_answer, question_order, time_limit, bank_question_id, hint, hint_penalty,
        points, explanation, topic, difficulty, evaluation_mode, sample_answer, answer_guidelines,
        option_e, sample_answers, ai_expected_solution, max_points, anti_cheat_exempt, is_bonus,
        ai_code_language, question_media, subquestions, solution_upload_config, circuit_spec,
        solution_upload_required, grading_type, expected_answer
      )
      SELECT
        ${newQuizId}, question_text, question_type, option_a, option_b, option_c, option_d,
        correct_answer, question_order, time_limit, bank_question_id, hint, hint_penalty,
        points, explanation, topic, difficulty, evaluation_mode, sample_answer, answer_guidelines,
        option_e, sample_answers, ai_expected_solution, max_points, anti_cheat_exempt, is_bonus,
        ai_code_language, question_media, subquestions, solution_upload_config, circuit_spec,
        solution_upload_required, grading_type, expected_answer
      FROM quiz_questions
      WHERE quiz_id = ${oldQuizId}
    `

    for (const row of qqRows) {
      if (row.bank_question_id == null) continue
      const mapped = questionMap.get(row.bank_question_id)
      if (mapped == null) continue
      await sql`
        UPDATE quiz_questions
        SET bank_question_id = ${mapped}
        WHERE quiz_id = ${newQuizId}
          AND bank_question_id = ${row.bank_question_id}
      `
    }
    // Schema repair on first import only — aligns quiz snapshots with normalized destination bank.
    await persistNormalizedQuizQuestionsForQuiz(newQuizId, destCourseId)
    count += 1
  }
  return count
}

async function cloneCoursePolicies(
  sourceCourseId: number,
  destCourseId: number,
  destInstructorId: number,
  modules: CourseExchangeModule[],
): Promise<number> {
  let updated = 0
  const includePractice = modulesInclude(modules, "practice_hub")
  const includeProjects = modulesInclude(modules, "projects") || modulesInclude(modules, "groups")

  if (!includePractice && !includeProjects) return 0

  const policyExists = (await sql`
    SELECT 1 FROM course_policies WHERE course_id = ${destCourseId} LIMIT 1
  `) as unknown[]
  if (policyExists.length === 0) {
    await sql`
      INSERT INTO course_policies (course_id, updated_by)
      VALUES (${destCourseId}, ${destInstructorId})
    `
  }

  if (includePractice) {
    await sql`
      UPDATE course_policies dst
      SET practice_hub_policy = src.practice_hub_policy,
          updated_by = ${destInstructorId},
          updated_at = NOW()
      FROM course_policies src
      WHERE src.course_id = ${sourceCourseId}
        AND dst.course_id = ${destCourseId}
        AND src.practice_hub_policy IS NOT NULL
    `
    updated += 1
  }
  if (includeProjects) {
    await sql`
      UPDATE course_policies dst
      SET project_policy = src.project_policy,
          updated_by = ${destInstructorId},
          updated_at = NOW()
      FROM course_policies src
      WHERE src.course_id = ${sourceCourseId}
        AND dst.course_id = ${destCourseId}
        AND src.project_policy IS NOT NULL
    `
    updated += 1
  }
  return updated
}

async function clonePlaygroundTemplates(
  sourceCourseId: number,
  destCourseId: number,
  destInstructorId: number,
  questionMap: Map<number, number>,
  sessionMap: Map<number, number>,
  reuseMaps?: CloneIdMaps | null,
): Promise<number> {
  const srcSessions = (await sql`
    SELECT id FROM playground_sessions
    WHERE course_id = ${sourceCourseId}
      AND mode = 'CLASSROOM'
      AND instructor_id IS NOT NULL
    ORDER BY id
  `) as { id: number }[]

  let count = 0
  for (const { id: oldSessionId } of srcSessions) {
    const existingDest = reuseMaps?.playgroundSessions.get(oldSessionId)
    if (existingDest && (await destRowExists("playground_sessions", existingDest, destCourseId))) {
      sessionMap.set(oldSessionId, existingDest)
      count += 1
      continue
    }
    const inserted = (await sql`
      INSERT INTO playground_sessions (
        session_code, mode, duration_sec, is_active, game_started, join_passcode,
        selected_topics, question_count, current_question_index, created_at, ended_at,
        lobby_opened_at, game_started_at, allowed_sessions, course_id, instructor_id
      )
      SELECT
        session_code || '-cx' || ${destCourseId}::text, mode, duration_sec, false, false, NULL,
        selected_topics, question_count, 0, NOW(), NULL,
        NULL, NULL, allowed_sessions, ${destCourseId}, ${destInstructorId}
      FROM playground_sessions
      WHERE id = ${oldSessionId}
      RETURNING id
    `) as { id: number }[]
    const newSessionId = inserted[0].id
    sessionMap.set(oldSessionId, newSessionId)

    const pqRows = (await sql`
      SELECT bank_question_id, question_order
      FROM playground_questions
      WHERE session_id = ${oldSessionId}
      ORDER BY question_order
    `) as { bank_question_id: number | null; question_order: number }[]

    for (const pq of pqRows) {
      const mappedBank = pq.bank_question_id != null ? questionMap.get(pq.bank_question_id) ?? null : null
      await sql`
        INSERT INTO playground_questions (session_id, bank_question_id, question_order)
        VALUES (${newSessionId}, ${mappedBank}, ${pq.question_order})
      `
    }
    count += 1
  }
  return count
}

async function cloneGroupsWithoutMembers(
  sourceCourseId: number,
  destCourseId: number,
  destInstructorId: number,
  groupMap: Map<number, number>,
  destinationSessionCode?: string | null,
  destinationSessionId?: number | null,
  reuseMaps?: CloneIdMaps | null,
): Promise<number> {
  void destInstructorId
  const groupCols = await getGroupsProjectsCourseIdColumns()
  const destSessionId =
    destinationSessionId != null && Number.isFinite(Number(destinationSessionId)) && Number(destinationSessionId) > 0
      ? Math.trunc(Number(destinationSessionId))
      : null

  const srcGroups = (await sql`
    SELECT id FROM groups
    WHERE course_id = ${sourceCourseId}
      AND deleted_at IS NULL
      AND status = 'approved'
    ORDER BY id
  `) as { id: number }[]

  let count = 0
  for (const { id: oldGroupId } of srcGroups) {
    const existingDest = reuseMaps?.groups.get(oldGroupId)
    if (existingDest) {
      const rows = (await sql`
        SELECT 1 FROM groups
        WHERE id = ${existingDest}
          AND course_id = ${destCourseId}
          AND deleted_at IS NULL
        LIMIT 1
      `) as unknown[]
      if (rows.length > 0) {
        groupMap.set(oldGroupId, existingDest)
        count += 1
        continue
      }
    }

    const inserted =
      groupCols.groupsHasSessionId && destSessionId != null
        ? ((await sql`
            INSERT INTO groups (name, session, session_id, created_by, status, course_id, pending_changes)
            SELECT
              name,
              COALESCE(
                (SELECT code FROM sessions WHERE id = ${destSessionId} LIMIT 1),
                ${destinationSessionCode ?? null},
                session
              ),
              ${destSessionId},
              created_by,
              'approved',
              ${destCourseId},
              NULL
            FROM groups
            WHERE id = ${oldGroupId}
            RETURNING id
          `) as { id: number }[])
        : ((await sql`
            INSERT INTO groups (name, session, created_by, status, course_id, pending_changes)
            SELECT
              name,
              COALESCE(${destinationSessionCode ?? null}, session),
              created_by,
              'approved',
              ${destCourseId},
              NULL
            FROM groups
            WHERE id = ${oldGroupId}
            RETURNING id
          `) as { id: number }[])

    groupMap.set(oldGroupId, inserted[0].id)
    count += 1
  }
  return count
}

async function cloneProjectsWithoutStudents(
  sourceCourseId: number,
  destCourseId: number,
  groupMap: Map<number, number>,
): Promise<number> {
  if (groupMap.size === 0) return 0
  const oldGroupIds = [...groupMap.keys()]
  const srcProjects = (await sql`
    SELECT id, group_id, title, summary, deliverables, target_platform
    FROM projects
    WHERE course_id = ${sourceCourseId}
      AND group_id = ANY(${oldGroupIds}::int[])
    ORDER BY id
  `) as {
    id: number
    group_id: number
    title: string
    summary: string | null
    deliverables: string | null
    target_platform: string | null
  }[]

  let count = 0
  for (const proj of srcProjects) {
    const newGroupId = groupMap.get(proj.group_id)
    if (!newGroupId) continue
    const existing = (await sql`
      SELECT id FROM projects
      WHERE course_id = ${destCourseId}
        AND group_id = ${newGroupId}
        AND title = ${proj.title}
      LIMIT 1
    `) as { id: number }[]
    if (existing.length > 0) continue
    await sql`
      INSERT INTO projects (
        group_id, title, summary, deliverables, target_platform, status, course_id
      )
      VALUES (
        ${newGroupId}, ${proj.title}, ${proj.summary}, ${proj.deliverables},
        ${proj.target_platform}, 'pending', ${destCourseId}
      )
    `
    count += 1
  }
  return count
}

async function verifyNoStudentDataCopied(
  destCourseId: number,
  quizIds: number[],
): Promise<Record<string, number>> {
  const checks: Record<string, number> = {}

  const enrollments = (await sql`
    SELECT COUNT(*)::int AS n FROM students WHERE course_id = ${destCourseId} AND deleted_at IS NULL
  `) as { n: number }[]
  checks.students = enrollments[0]?.n ?? 0

  if (quizIds.length > 0) {
    const attempts = (await sql`
      SELECT COUNT(*)::int AS n FROM quiz_attempts
      WHERE quiz_id = ANY(${quizIds}::int[]) AND deleted_at IS NULL
    `) as { n: number }[]
    checks.quiz_attempts = attempts[0]?.n ?? 0

    const grades = (await sql`
      SELECT COUNT(*)::int AS n FROM quiz_answers qa
      JOIN quiz_attempts qat ON qat.id = qa.attempt_id
      WHERE qat.quiz_id = ANY(${quizIds}::int[])
    `) as { n: number }[]
    checks.quiz_answers = grades[0]?.n ?? 0
  } else {
    checks.quiz_attempts = 0
    checks.quiz_answers = 0
  }

  const practiceAttempts = (await sql`
    SELECT COUNT(*)::int AS n
    FROM practice_attempts pa
    JOIN students s ON s.id = pa.student_id
    WHERE s.course_id = ${destCourseId}
  `) as { n: number }[]
  checks.practice_attempts = practiceAttempts[0]?.n ?? 0

  const cpAwards = (await sql`
    SELECT COUNT(*)::int AS n FROM classroom_points cp
    JOIN students s ON s.id = cp.student_id
    WHERE s.course_id = ${destCourseId}
  `) as { n: number }[]
  checks.classroom_point_awards = cpAwards[0]?.n ?? 0

  return checks
}

/** Clone approved teaching modules into an independent destination course. */
export async function cloneCourseContent(
  input: CloneCourseContentInput,
): Promise<CloneCourseContentResult> {
  const {
    sourceCourseId,
    destinationCourseId,
    destinationInstructorId,
    destinationSessionCode,
    reuseMaps,
  } = input

  const { modules: selectedModules, skippedGroupsProjects } = filterGroupsProjectsForOwnSession(
    input.selectedModules,
    destinationSessionCode ?? null,
  )
  if (
    skippedGroupsProjects &&
    selectedModules.length === 0 &&
    input.selectedModules.some((m) => m === "groups" || m === "projects")
  ) {
    throw new Error(ownGroupsProjectsSessionMessage())
  }

  const maps = input.maps ?? emptyMaps()
  const summary: Record<string, number> = {}
  if (skippedGroupsProjects) {
    summary.groups_projects_skipped = 1
  }

  const destinationReuse = await buildDestinationReuseMaps({
    sourceCourseId,
    destinationCourseId,
    modules: selectedModules,
    destinationSessionCode,
    destinationSessionId: input.destinationSessionId ?? null,
  })
  const effectiveReuseMaps = mergeReuseMaps(reuseMaps ?? emptyReuseMaps(), destinationReuse)

  await sql`BEGIN`
  try {
    const needsBank = questionBankRequired(selectedModules)

    if (needsBank) {
      summary.question_bank = await cloneQuestionBank(
        sourceCourseId,
        destinationCourseId,
        destinationInstructorId,
        maps.questionBank,
        effectiveReuseMaps,
      )
    }

    if (modulesInclude(selectedModules, "syllabus")) {
      summary.syllabus = await cloneSyllabus(
        sourceCourseId,
        destinationCourseId,
        destinationInstructorId,
        input.destinationSessionId ?? null,
      )
    }

    if (modulesInclude(selectedModules, "lectures")) {
      summary.lectures = await cloneLectures(
        sourceCourseId,
        destinationCourseId,
        destinationInstructorId,
        maps.lectures,
        effectiveReuseMaps,
      )
    }

    if (modulesInclude(selectedModules, "course_notes")) {
      summary.course_notes = await cloneCourseNotes(
        sourceCourseId,
        destinationCourseId,
        destinationInstructorId,
        maps.courseNotes,
        effectiveReuseMaps,
      )
    }

    if (modulesInclude(selectedModules, "flashcards")) {
      summary.flashcards = await cloneFlashcards(
        sourceCourseId,
        destinationCourseId,
        destinationInstructorId,
        maps.flashcardDecks,
        effectiveReuseMaps,
      )
    }

    if (modulesInclude(selectedModules, "practice_hub") && maps.questionBank.size > 0) {
      summary.practice_availability = await clonePracticeAvailability(
        sourceCourseId,
        maps.questionBank,
        destinationSessionCode,
      )
    }

    const assessmentTypes = assessmentTypesForModules(selectedModules)
    if (assessmentTypes.length > 0) {
      summary.assessments = await cloneAssessments(
        sourceCourseId,
        destinationCourseId,
        destinationInstructorId,
        assessmentTypes,
        maps.questionBank,
        maps.quizzes,
        effectiveReuseMaps,
      )
    }

    if (
      modulesInclude(selectedModules, "classroom_points") ||
      modulesInclude(selectedModules, "practice_hub") ||
      modulesInclude(selectedModules, "projects") ||
      modulesInclude(selectedModules, "groups")
    ) {
      summary.course_policies = await cloneCoursePolicies(
        sourceCourseId,
        destinationCourseId,
        destinationInstructorId,
        selectedModules,
      )
    }

    if (modulesInclude(selectedModules, "classroom_points")) {
      summary.classroom_point_assignments = await cloneClassroomPointAssignmentsToCourse({
        sourceCourseId,
        destinationCourseId,
        destinationInstructorId,
        destinationSessionCode,
      })
    }

    if (modulesInclude(selectedModules, "playground") && maps.questionBank.size > 0) {
      summary.playground_sessions = await clonePlaygroundTemplates(
        sourceCourseId,
        destinationCourseId,
        destinationInstructorId,
        maps.questionBank,
        maps.playgroundSessions,
        effectiveReuseMaps,
      )
    }

    if (modulesInclude(selectedModules, "groups")) {
      summary.groups = await cloneGroupsWithoutMembers(
        sourceCourseId,
        destinationCourseId,
        destinationInstructorId,
        maps.groups,
        destinationSessionCode,
        input.destinationSessionId ?? null,
        effectiveReuseMaps,
      )
    }

    if (modulesInclude(selectedModules, "projects")) {
      if (!modulesInclude(selectedModules, "groups")) {
        summary.groups = await cloneGroupsWithoutMembers(
          sourceCourseId,
          destinationCourseId,
          destinationInstructorId,
          maps.groups,
          destinationSessionCode,
          input.destinationSessionId ?? null,
          effectiveReuseMaps,
        )
      }
      summary.projects = await cloneProjectsWithoutStudents(
        sourceCourseId,
        destinationCourseId,
        maps.groups,
      )
    }

    const quizIds = [...maps.quizzes.values()]
    const studentDataChecks = await verifyNoStudentDataCopied(destinationCourseId, quizIds)

    for (const [key, count] of Object.entries(studentDataChecks)) {
      if (count > 0) {
        throw new Error(`Student data must not be copied (${key}: ${count})`)
      }
    }

    await sql`COMMIT`

    return { maps, summary, studentDataChecks }
  } catch (error) {
    await sql`ROLLBACK`
    throw error
  }
}

const POST_COPY_CHECKLIST = [
  "Syllabus dates",
  "Assessment availability",
  "Due dates",
  "Lecture schedule",
  "Grading policies",
  "Classroom Points",
  "Practice settings",
  "Publish status",
] as const

/** Remove previously cloned teaching content before a failed-import retry. */
export async function clearDestinationExchangeContent(destinationCourseId: number): Promise<void> {
  await sql`BEGIN`
  try {
    await sql`
      DELETE FROM quiz_questions
      WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = ${destinationCourseId})
    `
    await sql`DELETE FROM quizzes WHERE course_id = ${destinationCourseId}`

    await sql`
      DELETE FROM lecture_slides
      WHERE lecture_id IN (SELECT id FROM lectures WHERE course_id = ${destinationCourseId})
    `
    await sql`DELETE FROM lectures WHERE course_id = ${destinationCourseId}`

    await sql`
      DELETE FROM flashcard_cards
      WHERE deck_id IN (SELECT id FROM flashcard_decks WHERE course_id = ${destinationCourseId})
    `
    await sql`DELETE FROM flashcard_decks WHERE course_id = ${destinationCourseId}`

    await sql`
      DELETE FROM playground_questions
      WHERE session_id IN (SELECT id FROM playground_sessions WHERE course_id = ${destinationCourseId})
    `
    await sql`DELETE FROM playground_sessions WHERE course_id = ${destinationCourseId}`

    await sql`DELETE FROM course_digital_notes WHERE course_id = ${destinationCourseId}`
    await sql`DELETE FROM course_syllabi WHERE course_id = ${destinationCourseId}`
    await sql`DELETE FROM course_policies WHERE course_id = ${destinationCourseId}`
    await sql`DELETE FROM question_bank WHERE course_id = ${destinationCourseId}`

    await sql`
      DELETE FROM projects
      WHERE course_id = ${destinationCourseId}
         OR group_id IN (SELECT id FROM groups WHERE course_id = ${destinationCourseId})
    `
    await sql`DELETE FROM groups WHERE course_id = ${destinationCourseId}`

    await sql`COMMIT`
  } catch (error) {
    await sql`ROLLBACK`
    throw error
  }
}

export { POST_COPY_CHECKLIST }
