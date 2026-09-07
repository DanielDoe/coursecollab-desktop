/**
 * Course-level playground rules stored in course_policies.playground_policy JSONB.
 */

export type PlaygroundPolicy = {
  /** When true, hide peer names/scores on student leaderboards (FERPA-style). Default: visible. */
  blur_leaderboard_peer_names: boolean
  default_question_count: number
  default_duration_sec: number
  min_duration_sec: number
  max_duration_sec: number
  max_questions_per_session: number
  points_per_correct_max: number
  points_per_correct_min: number
  speed_bonus_window_ms: number
  allow_student_nicknames: boolean
  show_accuracy_on_leaderboard: boolean
  /** When true, instructors must pick class sections; empty selection blocks start. */
  require_session_restriction: boolean
  /** Pre-selected section IDs when starting a session (empty = all sections). */
  default_allowed_session_ids: number[]
  max_concurrent_live_sessions: number
  sync_engagement_points: boolean
}

export const DEFAULT_PLAYGROUND_POLICY: PlaygroundPolicy = {
  blur_leaderboard_peer_names: false,
  default_question_count: 10,
  default_duration_sec: 10,
  min_duration_sec: 5,
  max_duration_sec: 60,
  max_questions_per_session: 50,
  points_per_correct_max: 5,
  points_per_correct_min: 3,
  speed_bonus_window_ms: 10000,
  allow_student_nicknames: true,
  show_accuracy_on_leaderboard: true,
  require_session_restriction: false,
  default_allowed_session_ids: [],
  max_concurrent_live_sessions: 1,
  sync_engagement_points: true,
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v
  return fallback
}

function parseNum(v: unknown, fallback: number, min = 0, max = 100000): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return clamp(n, min, max)
}

function parseSessionIds(v: unknown): number[] {
  if (!Array.isArray(v)) return []
  return v
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)
}

export function parsePlaygroundPolicy(raw: unknown): PlaygroundPolicy {
  const d = DEFAULT_PLAYGROUND_POLICY
  if (!raw || typeof raw !== "object") return { ...d, default_allowed_session_ids: [] }
  const o = raw as Record<string, unknown>

  const pointsMax = parseNum(o.points_per_correct_max, d.points_per_correct_max, 1, 100)
  const pointsMin = parseNum(o.points_per_correct_min, d.points_per_correct_min, 0, pointsMax)
  const minDuration = parseNum(o.min_duration_sec, d.min_duration_sec, 3, 300)
  const maxDuration = parseNum(o.max_duration_sec, d.max_duration_sec, minDuration, 600)
  const defaultDuration = parseNum(o.default_duration_sec, d.default_duration_sec, minDuration, maxDuration)
  const maxQuestions = parseNum(o.max_questions_per_session, d.max_questions_per_session, 1, 200)
  const defaultQuestions = parseNum(o.default_question_count, d.default_question_count, 1, maxQuestions)

  return {
    blur_leaderboard_peer_names: parseBool(o.blur_leaderboard_peer_names, d.blur_leaderboard_peer_names),
    default_question_count: defaultQuestions,
    default_duration_sec: defaultDuration,
    min_duration_sec: minDuration,
    max_duration_sec: maxDuration,
    max_questions_per_session: maxQuestions,
    points_per_correct_max: pointsMax,
    points_per_correct_min: Math.min(pointsMin, pointsMax),
    speed_bonus_window_ms: parseNum(o.speed_bonus_window_ms, d.speed_bonus_window_ms, 1000, 120000),
    allow_student_nicknames: parseBool(o.allow_student_nicknames, d.allow_student_nicknames),
    show_accuracy_on_leaderboard: parseBool(o.show_accuracy_on_leaderboard, d.show_accuracy_on_leaderboard),
    require_session_restriction: parseBool(o.require_session_restriction, d.require_session_restriction),
    default_allowed_session_ids: parseSessionIds(o.default_allowed_session_ids),
    max_concurrent_live_sessions: parseNum(o.max_concurrent_live_sessions, d.max_concurrent_live_sessions, 1, 5),
    sync_engagement_points: parseBool(o.sync_engagement_points, d.sync_engagement_points),
  }
}

export function mergePlaygroundPolicy(existing: unknown, patch: Partial<PlaygroundPolicy>): PlaygroundPolicy {
  const base = parsePlaygroundPolicy(existing)
  return parsePlaygroundPolicy({ ...base, ...patch })
}

export type PlaygroundScoringConfig = {
  pointsMax: number
  pointsMin: number
  speedWindowMs: number
}

export function playgroundScoringFromPolicy(policy: PlaygroundPolicy): PlaygroundScoringConfig {
  return {
    pointsMax: policy.points_per_correct_max,
    pointsMin: policy.points_per_correct_min,
    speedWindowMs: policy.speed_bonus_window_ms,
  }
}
