/**
 * CodeBench badge award logic (server-only — imports DB).
 */

import { sql } from "@/lib/db"
import {
  BADGE_DEFINITIONS,
  type CodebenchBadgeId,
} from "@/lib/codebench-badge-catalog"

export {
  BADGE_DEFINITIONS,
  getCodebenchBadgeCatalog,
  type CodebenchBadgeDef,
  type CodebenchBadgeId,
} from "@/lib/codebench-badge-catalog"

async function awardBadge(
  studentId: number,
  badgeId: string,
  badgeData: { name: string; icon: string },
) {
  try {
    await sql`
      INSERT INTO student_achievements (student_id, badge_type, badge_name, badge_icon, badge_color)
      VALUES (${studentId}, ${badgeId}, ${badgeData.name}, ${badgeData.icon}, '#6366f1')
      ON CONFLICT (student_id, badge_type) DO NOTHING
    `
  } catch (error) {
    console.error(`[Codebench Badges] Failed to award ${badgeId}:`, error)
  }
}

async function maybeAward(studentId: number, id: CodebenchBadgeId, met: boolean) {
  if (!met) return
  const def = BADGE_DEFINITIONS[id]
  await awardBadge(studentId, id, def)
}

/** Check and award badges based on current performance. Call directly (no HTTP fetch). */
export async function checkAndAwardBadges(studentId: number): Promise<void> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS student_achievements (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        badge_type VARCHAR(50) NOT NULL,
        badge_name VARCHAR(100) NOT NULL,
        badge_icon VARCHAR(20) NOT NULL,
        badge_color VARCHAR(20) DEFAULT '#6366f1',
        earned_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(student_id, badge_type)
      )
    `

    const [submissionStats] = await sql`
      SELECT 
        COUNT(*) as total_submissions,
        COUNT(CASE WHEN cs.status = 'approved' THEN 1 END) as approved_submissions,
        COUNT(CASE WHEN cs.score >= 100 THEN 1 END) as perfect_scores,
        COUNT(CASE WHEN cs.score >= 90 THEN 1 END) as high_scores,
        COALESCE(SUM(cs.points_awarded), 0) as total_xp
      FROM codebench_submissions cs
      WHERE cs.student_id = ${studentId}
    `
    const stats = submissionStats || {
      total_submissions: 0,
      approved_submissions: 0,
      perfect_scores: 0,
      high_scores: 0,
      total_xp: 0,
    }

    let practiceCount = 0
    let challengeCount = 0
    try {
      const [practiceRow] = await sql`
        SELECT COUNT(*) as count FROM practice_submissions WHERE student_id = ${studentId}
      `
      practiceCount = parseInt(String(practiceRow?.count || 0), 10)
    } catch {
      /* ignore */
    }
    try {
      const [challengeRow] = await sql`
        SELECT COUNT(*) as count FROM daily_challenge_submissions WHERE student_id = ${studentId}
      `
      challengeCount = parseInt(String(challengeRow?.count || 0), 10)
    } catch {
      /* ignore */
    }

    let streakDays = 0
    try {
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'daily_challenge_submissions'
        )
      `
      const hasDailyChallengeTable = tableExists[0]?.exists || false

      const streakQuery = hasDailyChallengeTable
        ? sql`
            WITH codebench_activity AS (
              SELECT DATE(cs.submitted_at) as activity_date
              FROM codebench_submissions cs
              WHERE cs.student_id = ${studentId} AND cs.submitted_at >= CURRENT_DATE - INTERVAL '60 days'
              GROUP BY DATE(cs.submitted_at)
            ),
            practice_activity AS (
              SELECT DATE(ps.submitted_at) as activity_date
              FROM practice_submissions ps
              WHERE ps.student_id = ${studentId} AND ps.submitted_at >= CURRENT_DATE - INTERVAL '60 days'
              GROUP BY DATE(ps.submitted_at)
            ),
            daily_challenge_activity AS (
              SELECT DATE(dcs.submitted_at) as activity_date
              FROM daily_challenge_submissions dcs
              WHERE dcs.student_id = ${studentId} AND dcs.submitted_at >= CURRENT_DATE - INTERVAL '60 days'
              GROUP BY DATE(dcs.submitted_at)
            ),
            combined_activity AS (
              SELECT DISTINCT activity_date FROM codebench_activity
              UNION SELECT DISTINCT activity_date FROM practice_activity
              UNION SELECT DISTINCT activity_date FROM daily_challenge_activity
            ),
            ordered_activity AS (
              SELECT activity_date,
                activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC) || ' days')::INTERVAL as streak_group
              FROM combined_activity
            )
            SELECT COUNT(*) as streak_days FROM ordered_activity
            WHERE streak_group = (SELECT streak_group FROM ordered_activity ORDER BY activity_date DESC LIMIT 1)
          `
        : sql`
            WITH codebench_activity AS (
              SELECT DATE(cs.submitted_at) as activity_date
              FROM codebench_submissions cs
              WHERE cs.student_id = ${studentId} AND cs.submitted_at >= CURRENT_DATE - INTERVAL '60 days'
              GROUP BY DATE(cs.submitted_at)
            ),
            practice_activity AS (
              SELECT DATE(ps.submitted_at) as activity_date
              FROM practice_submissions ps
              WHERE ps.student_id = ${studentId} AND ps.submitted_at >= CURRENT_DATE - INTERVAL '60 days'
              GROUP BY DATE(ps.submitted_at)
            ),
            combined_activity AS (
              SELECT DISTINCT activity_date FROM codebench_activity
              UNION SELECT DISTINCT activity_date FROM practice_activity
            ),
            ordered_activity AS (
              SELECT activity_date,
                activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC) || ' days')::INTERVAL as streak_group
              FROM combined_activity
            )
            SELECT COUNT(*) as streak_days FROM ordered_activity
            WHERE streak_group = (SELECT streak_group FROM ordered_activity ORDER BY activity_date DESC LIMIT 1)
          `
      const streakResult = await streakQuery
      streakDays = parseInt(streakResult[0]?.streak_days || 0)
    } catch {
      /* ignore */
    }

    const [conceptUsage] = await sql`
      SELECT 
        COUNT(CASE WHEN (cs.code LIKE '%for%' OR cs.code LIKE '%while%') AND cs.status = 'approved' THEN 1 END) as loops,
        COUNT(CASE WHEN (cs.code LIKE '%class%' OR cs.code LIKE '%struct%') AND cs.status = 'approved' THEN 1 END) as oop,
        COUNT(CASE WHEN (cs.code LIKE '%*%' OR cs.code LIKE '%&%') AND cs.status = 'approved' THEN 1 END) as pointers,
        COUNT(CASE WHEN (cs.code LIKE '%vector%' OR cs.code LIKE '%map%' OR cs.code LIKE '%set%' OR cs.code LIKE '%list%') AND cs.status = 'approved' THEN 1 END) as stl,
        COUNT(CASE WHEN (cs.code LIKE '%recursive%' OR cs.code LIKE '%recursion%') AND cs.status = 'approved' THEN 1 END) as recursion,
        COUNT(CASE WHEN (cs.code LIKE '%[%' OR cs.code LIKE '%array%') AND cs.status = 'approved' THEN 1 END) as arrays
      FROM codebench_submissions cs
      WHERE cs.student_id = ${studentId}
    `
    const concepts = conceptUsage || {
      loops: 0,
      oop: 0,
      pointers: 0,
      stl: 0,
      recursion: 0,
      arrays: 0,
    }

    const total = Number(stats.total_submissions || 0)
    const approved = Number(stats.approved_submissions || 0)
    const perfect = Number(stats.perfect_scores || 0)
    const high = Number(stats.high_scores || 0)
    const xp = Number(stats.total_xp || 0)

    await maybeAward(studentId, "loops_master", Number(concepts.loops || 0) >= BADGE_DEFINITIONS.loops_master.threshold)
    await maybeAward(studentId, "bug_hunter", total >= BADGE_DEFINITIONS.bug_hunter.threshold)
    await maybeAward(studentId, "clean_code", approved >= BADGE_DEFINITIONS.clean_code.threshold)
    await maybeAward(studentId, "oop_apprentice", Number(concepts.oop || 0) >= BADGE_DEFINITIONS.oop_apprentice.threshold)
    await maybeAward(
      studentId,
      "pointer_pathfinder",
      Number(concepts.pointers || 0) >= BADGE_DEFINITIONS.pointer_pathfinder.threshold,
    )
    await maybeAward(
      studentId,
      "recursion_king",
      Number(concepts.recursion || 0) >= BADGE_DEFINITIONS.recursion_king.threshold,
    )
    await maybeAward(studentId, "stl_expert", Number(concepts.stl || 0) >= BADGE_DEFINITIONS.stl_expert.threshold)
    await maybeAward(studentId, "arrays_ace", Number(concepts.arrays || 0) >= BADGE_DEFINITIONS.arrays_ace.threshold)

    await maybeAward(studentId, "first_blood", total >= BADGE_DEFINITIONS.first_blood.threshold)
    await maybeAward(studentId, "rising_coder", total >= BADGE_DEFINITIONS.rising_coder.threshold)
    await maybeAward(studentId, "perfectionist", perfect >= BADGE_DEFINITIONS.perfectionist.threshold)
    await maybeAward(studentId, "high_scorer", high >= BADGE_DEFINITIONS.high_scorer.threshold)

    await maybeAward(studentId, "challenge_starter", challengeCount >= BADGE_DEFINITIONS.challenge_starter.threshold)
    await maybeAward(studentId, "challenge_champ", challengeCount >= BADGE_DEFINITIONS.challenge_champ.threshold)
    await maybeAward(studentId, "practice_pro", practiceCount >= BADGE_DEFINITIONS.practice_pro.threshold)

    await maybeAward(studentId, "streak_3", streakDays >= BADGE_DEFINITIONS.streak_3.threshold)
    await maybeAward(studentId, "streak_7", streakDays >= BADGE_DEFINITIONS.streak_7.threshold)
    await maybeAward(studentId, "streak_14", streakDays >= BADGE_DEFINITIONS.streak_14.threshold)
    await maybeAward(studentId, "streak_30", streakDays >= BADGE_DEFINITIONS.streak_30.threshold)

    await maybeAward(studentId, "xp_collector", xp >= BADGE_DEFINITIONS.xp_collector.threshold)
  } catch (error) {
    console.error("[Codebench Badges] Error:", error)
  }
}
