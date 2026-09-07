/**
 * Course-level policy knobs stored in course_policies JSONB columns.
 */

import { CLASSROOM_POINTS_FOR_FULL_GRADE } from "@/lib/classroom-points-grade-scale"

export type AttendancePolicy = {
  require_location_default: boolean
  qr_expiry_minutes_default: number
  radius_meters_default: number
  minimum_attendance_percent: number
  late_arrival_grace_minutes: number
  structured_attendance_late_after_minutes: number
  present_score: number
  late_score: number
  absent_score: number
  excused_full_credit: boolean
  excused_absence_notes: string
  /** When true, student attendance ranks hide peer names (FERPA). Default off when roster opted in. */
  blur_leaderboard_peer_names: boolean
}

export type RewardsPolicy = {
  points_for_full_grade: number
  allow_student_submissions: boolean
  /** Classroom code/solution submissions: AI feedback then award immediately when on. */
  auto_approve_submissions: boolean
  /** Practice Hub circuit/multi-part uploads: AI feedback then credit immediately when on. */
  auto_approve_practice_submissions: boolean
  max_daily_submission_points: number
  duplicate_detection_enabled: boolean
  /** When true (default), student leaderboard hides peer names/points for FERPA. */
  blur_leaderboard_peer_names: boolean
  /** Show the Code Assignments block on the student classroom points page. */
  show_code_assignments: boolean
  /** Show the Solution Assignments block on the student classroom points page. */
  show_solution_assignments: boolean
}

export type ClassroomStudentSubmissionBlocks = Pick<
  RewardsPolicy,
  "show_code_assignments" | "show_solution_assignments"
>

export type ProjectPolicy = {
  min_team_size: number
  max_team_size: number
  allow_self_form_groups: boolean
  peer_review_required: boolean
  peer_review_weight_percent: number
  late_project_penalty_percent_per_day: number
}

export type CoursePoliciesBundle = {
  attendance_policy: AttendancePolicy
  rewards_policy: RewardsPolicy
  project_policy: ProjectPolicy
}

export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = {
  require_location_default: false,
  qr_expiry_minutes_default: 30,
  radius_meters_default: 100,
  minimum_attendance_percent: 75,
  late_arrival_grace_minutes: 10,
  structured_attendance_late_after_minutes: 20,
  present_score: 100,
  late_score: 50,
  absent_score: 0,
  excused_full_credit: false,
  excused_absence_notes: "",
  blur_leaderboard_peer_names: false,
}

export const DEFAULT_REWARDS_POLICY: RewardsPolicy = {
  points_for_full_grade: CLASSROOM_POINTS_FOR_FULL_GRADE,
  allow_student_submissions: true,
  auto_approve_submissions: true,
  auto_approve_practice_submissions: true,
  max_daily_submission_points: 50,
  duplicate_detection_enabled: true,
  blur_leaderboard_peer_names: true,
  show_code_assignments: true,
  show_solution_assignments: true,
}

export const DEFAULT_PROJECT_POLICY: ProjectPolicy = {
  min_team_size: 2,
  max_team_size: 5,
  allow_self_form_groups: true,
  peer_review_required: false,
  peer_review_weight_percent: 10,
  late_project_penalty_percent_per_day: 5,
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v
  return fallback
}

function parseNum(v: unknown, fallback: number, min = 0, max = 10000): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return clamp(n, min, max)
}

export function parseAttendancePolicy(raw: unknown): AttendancePolicy {
  const d = DEFAULT_ATTENDANCE_POLICY
  if (!raw || typeof raw !== "object") return { ...d }
  const o = raw as Record<string, unknown>
  return {
    require_location_default: parseBool(o.require_location_default, d.require_location_default),
    qr_expiry_minutes_default: parseNum(o.qr_expiry_minutes_default, d.qr_expiry_minutes_default, 1, 240),
    radius_meters_default: parseNum(o.radius_meters_default, d.radius_meters_default, 10, 5000),
    minimum_attendance_percent: parseNum(o.minimum_attendance_percent, d.minimum_attendance_percent, 0, 100),
    late_arrival_grace_minutes: parseNum(o.late_arrival_grace_minutes, d.late_arrival_grace_minutes, 0, 120),
    structured_attendance_late_after_minutes: parseNum(
      o.structured_attendance_late_after_minutes,
      d.structured_attendance_late_after_minutes,
      0,
      180,
    ),
    present_score: parseNum(o.present_score, d.present_score, 0, 100),
    late_score: parseNum(o.late_score, d.late_score, 0, 100),
    absent_score: parseNum(o.absent_score, d.absent_score, 0, 100),
    excused_full_credit: parseBool(o.excused_full_credit, d.excused_full_credit),
    excused_absence_notes: typeof o.excused_absence_notes === "string" ? o.excused_absence_notes : d.excused_absence_notes,
    blur_leaderboard_peer_names: parseBool(o.blur_leaderboard_peer_names, d.blur_leaderboard_peer_names),
  }
}

export function parseRewardsPolicy(raw: unknown): RewardsPolicy {
  const d = DEFAULT_REWARDS_POLICY
  if (!raw || typeof raw !== "object") return { ...d }
  const o = raw as Record<string, unknown>
  return {
    points_for_full_grade: parseNum(o.points_for_full_grade, d.points_for_full_grade, 1, 10000),
    allow_student_submissions: parseBool(o.allow_student_submissions, d.allow_student_submissions),
    auto_approve_submissions: parseBool(o.auto_approve_submissions, d.auto_approve_submissions),
    auto_approve_practice_submissions: parseBool(
      o.auto_approve_practice_submissions,
      d.auto_approve_practice_submissions,
    ),
    max_daily_submission_points: parseNum(o.max_daily_submission_points, d.max_daily_submission_points, 0, 1000),
    duplicate_detection_enabled: parseBool(o.duplicate_detection_enabled, d.duplicate_detection_enabled),
    blur_leaderboard_peer_names: parseBool(o.blur_leaderboard_peer_names, d.blur_leaderboard_peer_names),
    show_code_assignments: parseBool(o.show_code_assignments, d.show_code_assignments),
    show_solution_assignments: parseBool(o.show_solution_assignments, d.show_solution_assignments),
  }
}

export function classroomSubmissionBlocksLabel(
  blocks: ClassroomStudentSubmissionBlocks,
): "Code & Solution" | "Code only" | "Solution only" | "None" {
  if (blocks.show_code_assignments && blocks.show_solution_assignments) return "Code & Solution"
  if (blocks.show_code_assignments) return "Code only"
  if (blocks.show_solution_assignments) return "Solution only"
  return "None"
}

export function parseProjectPolicy(raw: unknown): ProjectPolicy {
  const d = DEFAULT_PROJECT_POLICY
  if (!raw || typeof raw !== "object") return { ...d }
  const o = raw as Record<string, unknown>
  const minTeam = parseNum(o.min_team_size, d.min_team_size, 1, 20)
  const maxTeam = parseNum(o.max_team_size, d.max_team_size, minTeam, 30)
  return {
    min_team_size: minTeam,
    max_team_size: maxTeam,
    allow_self_form_groups: parseBool(o.allow_self_form_groups, d.allow_self_form_groups),
    peer_review_required: parseBool(o.peer_review_required, d.peer_review_required),
    peer_review_weight_percent: parseNum(o.peer_review_weight_percent, d.peer_review_weight_percent, 0, 100),
    late_project_penalty_percent_per_day: parseNum(
      o.late_project_penalty_percent_per_day,
      d.late_project_penalty_percent_per_day,
      0,
      100,
    ),
  }
}

export function mergeAttendancePolicy(existing: unknown, patch: Partial<AttendancePolicy>): AttendancePolicy {
  const base = parseAttendancePolicy(existing)
  return parseAttendancePolicy({ ...base, ...patch })
}

export function mergeRewardsPolicy(existing: unknown, patch: Partial<RewardsPolicy>): RewardsPolicy {
  const base = parseRewardsPolicy(existing)
  return parseRewardsPolicy({ ...base, ...patch })
}

export function mergeProjectPolicy(existing: unknown, patch: Partial<ProjectPolicy>): ProjectPolicy {
  const base = parseProjectPolicy(existing)
  return parseProjectPolicy({ ...base, ...patch })
}

export function defaultCoursePoliciesBundle(): CoursePoliciesBundle {
  return {
    attendance_policy: { ...DEFAULT_ATTENDANCE_POLICY },
    rewards_policy: { ...DEFAULT_REWARDS_POLICY },
    project_policy: { ...DEFAULT_PROJECT_POLICY },
  }
}
