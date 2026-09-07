/**
 * Course-level Practice Hub rules stored in course_policies.practice_hub_policy JSONB.
 */

import type { MembershipTier } from "@/lib/membership-constants"

export type PracticeHubPolicy = {
  /** When true, hide peer names/scores on student leaderboards (FERPA-style). Default: visible. */
  blur_leaderboard_peer_names: boolean
  /** When true, Scholar tier may view leaderboard even if membership normally blocks it. */
  scholar_leaderboard_access: boolean
  show_accuracy_on_leaderboard: boolean
  show_response_time_on_leaderboard: boolean

  default_questions_per_session: number
  min_questions_per_session: number
  max_questions_per_session: number

  /** Daily question cap per tier (-1 = unlimited). */
  scholar_daily_question_cap: number
  explorer_daily_question_cap: number
  trailblazer_daily_question_cap: number

  /** Max questions per generated session per tier. */
  scholar_max_questions_per_session: number
  explorer_max_questions_per_session: number
  trailblazer_max_questions_per_session: number

  /** Weekly question cap per tier (-1 = unlimited). Scholar default: 10/week. */
  scholar_weekly_question_cap: number
  explorer_weekly_question_cap: number
  trailblazer_weekly_question_cap: number

  /** Explorer unlocks this fraction of each topic's questions (first N by id). Default 0.5. */
  explorer_unlock_fraction: number

  points_easy: number
  points_medium: number
  points_hard: number
  speed_bonus_max: number
  speed_bonus_window_ms: number
  first_attempt_bonus: number
  xp_multiplier: number
  xp_per_level: number

  sync_engagement_points: boolean
  engagement_base_per_attempt: number
  engagement_score_divisor: number

  allow_hints: boolean
  /** 0 = unlimited attempts per question in a session. */
  max_attempts_per_question: number
  show_explanations_after_wrong: boolean

  difficulty_easy_weight: number
  difficulty_medium_weight: number
  difficulty_hard_weight: number
}

export const DEFAULT_PRACTICE_HUB_POLICY: PracticeHubPolicy = {
  blur_leaderboard_peer_names: false,
  scholar_leaderboard_access: false,
  show_accuracy_on_leaderboard: true,
  show_response_time_on_leaderboard: true,

  default_questions_per_session: 10,
  min_questions_per_session: 5,
  max_questions_per_session: 50,

  scholar_daily_question_cap: 25,
  explorer_daily_question_cap: 100,
  trailblazer_daily_question_cap: -1,

  scholar_max_questions_per_session: 10,
  explorer_max_questions_per_session: 25,
  trailblazer_max_questions_per_session: 50,

  scholar_weekly_question_cap: 10,
  explorer_weekly_question_cap: -1,
  trailblazer_weekly_question_cap: -1,

  explorer_unlock_fraction: 0.5,

  points_easy: 10,
  points_medium: 15,
  points_hard: 25,
  speed_bonus_max: 5,
  speed_bonus_window_ms: 5000,
  first_attempt_bonus: 5,
  xp_multiplier: 2,
  xp_per_level: 500,

  sync_engagement_points: true,
  engagement_base_per_attempt: 8,
  engagement_score_divisor: 20,

  allow_hints: true,
  max_attempts_per_question: 0,
  show_explanations_after_wrong: true,

  difficulty_easy_weight: 0.3,
  difficulty_medium_weight: 0.5,
  difficulty_hard_weight: 0.2,
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v
  return fallback
}

function parseNum(v: unknown, fallback: number, min = -1, max = 100000): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return clamp(n, min, max)
}

export function parsePracticeHubPolicy(raw: unknown): PracticeHubPolicy {
  const d = DEFAULT_PRACTICE_HUB_POLICY
  if (!raw || typeof raw !== "object") return { ...d }
  const o = raw as Record<string, unknown>

  const maxSession = parseNum(o.max_questions_per_session, d.max_questions_per_session, 1, 200)
  const minSession = parseNum(o.min_questions_per_session, d.min_questions_per_session, 1, maxSession)
  const defaultSession = parseNum(o.default_questions_per_session, d.default_questions_per_session, minSession, maxSession)

  const scholarMax = parseNum(o.scholar_max_questions_per_session, d.scholar_max_questions_per_session, 1, maxSession)
  const explorerMax = parseNum(o.explorer_max_questions_per_session, d.explorer_max_questions_per_session, 1, maxSession)
  const trailblazerMax = parseNum(
    o.trailblazer_max_questions_per_session,
    d.trailblazer_max_questions_per_session,
    1,
    maxSession,
  )

  const easyW = parseNum(o.difficulty_easy_weight, d.difficulty_easy_weight, 0, 1)
  const medW = parseNum(o.difficulty_medium_weight, d.difficulty_medium_weight, 0, 1)
  const hardW = parseNum(o.difficulty_hard_weight, d.difficulty_hard_weight, 0, 1)
  const weightSum = easyW + medW + hardW || 1

  return {
    blur_leaderboard_peer_names: parseBool(o.blur_leaderboard_peer_names, d.blur_leaderboard_peer_names),
    scholar_leaderboard_access: parseBool(o.scholar_leaderboard_access, d.scholar_leaderboard_access),
    show_accuracy_on_leaderboard: parseBool(o.show_accuracy_on_leaderboard, d.show_accuracy_on_leaderboard),
    show_response_time_on_leaderboard: parseBool(
      o.show_response_time_on_leaderboard,
      d.show_response_time_on_leaderboard,
    ),

    default_questions_per_session: defaultSession,
    min_questions_per_session: minSession,
    max_questions_per_session: maxSession,

    scholar_daily_question_cap: parseNum(o.scholar_daily_question_cap, d.scholar_daily_question_cap, -1, 500),
    explorer_daily_question_cap: parseNum(o.explorer_daily_question_cap, d.explorer_daily_question_cap, -1, 500),
    trailblazer_daily_question_cap: parseNum(o.trailblazer_daily_question_cap, d.trailblazer_daily_question_cap, -1, 500),

    scholar_max_questions_per_session: scholarMax,
    explorer_max_questions_per_session: explorerMax,
    trailblazer_max_questions_per_session: trailblazerMax,

    scholar_weekly_question_cap: parseNum(o.scholar_weekly_question_cap, d.scholar_weekly_question_cap, -1, 500),
    explorer_weekly_question_cap: parseNum(o.explorer_weekly_question_cap, d.explorer_weekly_question_cap, -1, 500),
    trailblazer_weekly_question_cap: parseNum(
      o.trailblazer_weekly_question_cap,
      d.trailblazer_weekly_question_cap,
      -1,
      500,
    ),

    explorer_unlock_fraction: parseNum(o.explorer_unlock_fraction, d.explorer_unlock_fraction, 0.05, 0.95),

    points_easy: parseNum(o.points_easy, d.points_easy, 1, 100),
    points_medium: parseNum(o.points_medium, d.points_medium, 1, 100),
    points_hard: parseNum(o.points_hard, d.points_hard, 1, 100),
    speed_bonus_max: parseNum(o.speed_bonus_max, d.speed_bonus_max, 0, 50),
    speed_bonus_window_ms: parseNum(o.speed_bonus_window_ms, d.speed_bonus_window_ms, 1000, 120000),
    first_attempt_bonus: parseNum(o.first_attempt_bonus, d.first_attempt_bonus, 0, 50),
    xp_multiplier: parseNum(o.xp_multiplier, d.xp_multiplier, 1, 10),
    xp_per_level: parseNum(o.xp_per_level, d.xp_per_level, 100, 10000),

    sync_engagement_points: parseBool(o.sync_engagement_points, d.sync_engagement_points),
    engagement_base_per_attempt: parseNum(o.engagement_base_per_attempt, d.engagement_base_per_attempt, 0, 50),
    engagement_score_divisor: parseNum(o.engagement_score_divisor, d.engagement_score_divisor, 1, 100),

    allow_hints: parseBool(o.allow_hints, d.allow_hints),
    max_attempts_per_question: parseNum(o.max_attempts_per_question, d.max_attempts_per_question, 0, 10),
    show_explanations_after_wrong: parseBool(o.show_explanations_after_wrong, d.show_explanations_after_wrong),

    difficulty_easy_weight: easyW / weightSum,
    difficulty_medium_weight: medW / weightSum,
    difficulty_hard_weight: hardW / weightSum,
  }
}

export function mergePracticeHubPolicy(existing: unknown, patch: Partial<PracticeHubPolicy>): PracticeHubPolicy {
  const base = parsePracticeHubPolicy(existing)
  return parsePracticeHubPolicy({ ...base, ...patch })
}

export function practiceHubDailyCapForTier(tier: MembershipTier, policy: PracticeHubPolicy): number {
  if (tier === "Trailblazer") return policy.trailblazer_daily_question_cap
  if (tier === "Explorer") return policy.explorer_daily_question_cap
  return policy.scholar_daily_question_cap
}

export function practiceHubSessionMaxForTier(tier: MembershipTier, policy: PracticeHubPolicy): number {
  if (tier === "Trailblazer") return policy.trailblazer_max_questions_per_session
  if (tier === "Explorer") return policy.explorer_max_questions_per_session
  return policy.scholar_max_questions_per_session
}

export function practiceHubWeeklyCapForTier(tier: MembershipTier, policy: PracticeHubPolicy): number {
  if (tier === "Trailblazer") return policy.trailblazer_weekly_question_cap
  if (tier === "Explorer") return policy.explorer_weekly_question_cap
  return policy.scholar_weekly_question_cap
}

export function resolvePracticeSessionQuestionCount(
  tier: MembershipTier,
  policy: PracticeHubPolicy,
  requested?: number,
): number {
  const tierMax = practiceHubSessionMaxForTier(tier, policy)
  const base = requested ?? policy.default_questions_per_session

  if (tier === "Explorer" || tier === "Trailblazer") {
    return Math.max(base, 1)
  }

  return Math.min(Math.max(base, policy.min_questions_per_session), tierMax, policy.max_questions_per_session)
}

export type PracticeHubScoringInput = {
  difficulty?: string | null
  responseTimeMs?: number | null
  attemptNumber?: number
}

export function calculatePracticeQuestionXp(
  policy: PracticeHubPolicy,
  input: PracticeHubScoringInput,
): { basePoints: number; speedBonus: number; attemptBonus: number; totalPoints: number; xp: number } {
  const diff = String(input.difficulty ?? "medium").toLowerCase()
  const basePoints =
    diff === "easy" ? policy.points_easy : diff === "hard" ? policy.points_hard : policy.points_medium

  const responseTime = input.responseTimeMs ?? Number.MAX_SAFE_INTEGER
  const speedBonus =
    responseTime < policy.speed_bonus_window_ms
      ? Math.max(0, policy.speed_bonus_max - Math.floor(responseTime / 1000))
      : 0

  const attemptBonus = (input.attemptNumber ?? 1) === 1 ? policy.first_attempt_bonus : 0
  const totalPoints = basePoints + speedBonus + attemptBonus
  const xp = Math.round(totalPoints * policy.xp_multiplier)

  return { basePoints, speedBonus, attemptBonus, totalPoints, xp }
}

export function allocatePracticeDifficultyCounts(
  total: number,
  policy: Pick<
    PracticeHubPolicy,
    "difficulty_easy_weight" | "difficulty_medium_weight" | "difficulty_hard_weight"
  >,
): { easy: number; medium: number; hard: number } {
  const n = Math.max(1, total)
  let easy = Math.round(n * policy.difficulty_easy_weight)
  let medium = Math.round(n * policy.difficulty_medium_weight)
  let hard = Math.max(0, n - easy - medium)
  if (easy + medium + hard < n) hard += n - (easy + medium + hard)
  while (easy + medium + hard > n) {
    if (hard > 0) hard--
    else if (medium > 0) medium--
    else easy--
  }
  return { easy, medium, hard }
}

/** Subset exposed to student clients (no instructor-only fields). */
export function practiceHubPolicyForStudentClient(policy: PracticeHubPolicy) {
  return {
    scoring: {
      pointsEasy: policy.points_easy,
      pointsMedium: policy.points_medium,
      pointsHard: policy.points_hard,
      speedBonusMax: policy.speed_bonus_max,
      speedBonusWindowMs: policy.speed_bonus_window_ms,
      firstAttemptBonus: policy.first_attempt_bonus,
      xpMultiplier: policy.xp_multiplier,
    },
    xpPerLevel: policy.xp_per_level,
    ux: {
      allowHints: policy.allow_hints,
      maxAttemptsPerQuestion: policy.max_attempts_per_question,
      showExplanationsAfterWrong: policy.show_explanations_after_wrong,
    },
    leaderboard: {
      showAccuracy: policy.show_accuracy_on_leaderboard,
      showResponseTime: policy.show_response_time_on_leaderboard,
    },
  }
}
