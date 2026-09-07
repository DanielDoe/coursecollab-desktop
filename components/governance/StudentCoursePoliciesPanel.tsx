"use client"

import {
  Award,
  BookOpen,
  Brain,
  CalendarCheck,
  ClipboardList,
  FlaskConical,
  ShieldCheck,
  Users,
} from "lucide-react"
import type { AssessmentPolicy } from "@/lib/assessment-policy-settings"
import type { AttendancePolicy, ProjectPolicy, RewardsPolicy } from "@/lib/course-policy-settings"
import type { PlaygroundPolicy } from "@/lib/playground-policy-settings"
import type { PracticeHubPolicy } from "@/lib/practice-hub-policy-settings"
import { classroomSubmissionBlocksLabel } from "@/lib/course-policy-settings"
import { MembershipDisclaimer } from "@/components/governance/MembershipDisclaimer"
import { cn } from "@/lib/utils"

type Perks = {
  membershipPlatformPerks: boolean
  tradeCenterRedemptions: boolean
  label: string
}

export type StudentCoursePoliciesData = {
  source_label: string
  perks: Perks
  attendance_policy: AttendancePolicy
  rewards_policy: RewardsPolicy
  project_policy: ProjectPolicy
  playground_policy: PlaygroundPolicy
  practice_hub_policy: PracticeHubPolicy
  assessment_policy: AssessmentPolicy
  updated_at: string | null
}

function yesNo(v: boolean) {
  return v ? "Yes" : "No"
}

function PolicyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-xs text-[var(--cc-text-muted)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--cc-text)] sm:text-right">{value}</dd>
    </div>
  )
}

function PolicySection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string
  description?: string
  icon: typeof ShieldCheck
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-xl bg-[var(--muted)]/30 overflow-hidden", className)}>
      <div className="px-4 pt-4 pb-2 sm:px-5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-[var(--cc-accent-dark)]" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--cc-text)]">{title}</h2>
        </div>
        {description ? <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">{description}</p> : null}
      </div>
      <dl className="space-y-1 px-4 pb-4 sm:px-5 sm:pb-5">{children}</dl>
    </section>
  )
}

function retakePolicyLabel(v: string) {
  if (v === "latest") return "Latest attempt"
  if (v === "average") return "Average of attempts"
  return "Best attempt"
}

export function StudentCoursePoliciesPanel({ data }: { data: StudentCoursePoliciesData }) {
  const { attendance_policy: att, rewards_policy: rew, project_policy: proj, assessment_policy: assess, perks } = data
  const retakes = assess.retakes
  const integrity = assess.anti_cheat
  const submissionBlocks = classroomSubmissionBlocksLabel(rew)

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-[var(--muted)]/30 overflow-hidden">
        <div className="px-4 pt-4 pb-2 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--cc-accent-dark)]" aria-hidden />
            <h2 className="text-sm font-semibold text-[var(--cc-text)]">Assessment governance</h2>
            <span className="rounded-full bg-[var(--cc-accent-soft)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-accent-dark)]">
              {data.source_label}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
            How membership, Trade Center, and instructor settings interact for quizzes and graded work.
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-accent-dark)]">Instructor</p>
            <p className="mt-1 text-sm font-medium text-[var(--cc-text)]">Always controls grading rules</p>
            <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
              Attempts, deadlines, extensions, and accommodations are set per assessment unless noted below.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-accent-dark)]">Membership perks</p>
            <p className="mt-1 text-sm font-medium text-[var(--cc-text)]">
              {perks.membershipPlatformPerks ? "May apply" : "Not enabled"}
            </p>
            <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
              {perks.membershipPlatformPerks
                ? "Retakes, save-and-finish, or membership rollovers may be available when your instructor allows them."
                : "Membership does not add quiz attempts or grading changes in this course."}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-accent-dark)]">Trade Center</p>
            <p className="mt-1 text-sm font-medium text-[var(--cc-text)]">
              {perks.tradeCenterRedemptions ? "May apply" : "Not enabled"}
            </p>
            <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
              {perks.tradeCenterRedemptions
                ? "Points-for-rollover and similar redemptions can extend assessment access when configured."
                : "Trade Center cannot grant assessment extensions in this course."}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <PolicySection
          title="Attendance"
          description="Defaults for check-ins and participation requirements"
          icon={CalendarCheck}
        >
          <PolicyRow label="Minimum attendance" value={`${att.minimum_attendance_percent}%`} />
          <PolicyRow label="Late arrival grace" value={`${att.late_arrival_grace_minutes} min`} />
          <PolicyRow label="Location verification" value={yesNo(att.require_location_default)} />
          {att.require_location_default ? (
            <>
              <PolicyRow label="Check-in radius" value={`${att.radius_meters_default} m`} />
              <PolicyRow label="QR code expiry" value={`${att.qr_expiry_minutes_default} min`} />
            </>
          ) : null}
          {att.excused_absence_notes.trim() ? (
            <PolicyRow label="Excused absences" value={att.excused_absence_notes.trim()} />
          ) : null}
        </PolicySection>

        <PolicySection
          title="Classroom points"
          description="Engagement rewards and submission rules"
          icon={Award}
        >
          <PolicyRow label="Points for full grade" value={rew.points_for_full_grade.toLocaleString()} />
          <PolicyRow label="Student submissions" value={yesNo(rew.allow_student_submissions)} />
          <PolicyRow
            label="Classroom auto-approval"
            value={rew.auto_approve_submissions ? "AI review, then credit" : "Instructor review required"}
          />
          <PolicyRow
            label="Practice auto-approval"
            value={rew.auto_approve_practice_submissions ? "AI review, then credit" : "Instructor review required"}
          />
          <PolicyRow label="Max daily submission points" value={rew.max_daily_submission_points} />
          <PolicyRow label="Assignment types shown" value={submissionBlocks} />
          <PolicyRow label="Leaderboard peer names" value={rew.blur_leaderboard_peer_names ? "Hidden" : "Visible"} />
          <PolicyRow label="Duplicate detection" value={yesNo(rew.duplicate_detection_enabled)} />
        </PolicySection>

        <PolicySection
          title="Projects & teams"
          description="Group work and late submission defaults"
          icon={Users}
        >
          <PolicyRow label="Team size" value={`${proj.min_team_size}–${proj.max_team_size} students`} />
          <PolicyRow label="Self-form groups" value={yesNo(proj.allow_self_form_groups)} />
          <PolicyRow label="Peer review required" value={yesNo(proj.peer_review_required)} />
          {proj.peer_review_required ? (
            <PolicyRow label="Peer review weight" value={`${proj.peer_review_weight_percent}%`} />
          ) : null}
          <PolicyRow
            label="Late penalty"
            value={
              proj.late_project_penalty_percent_per_day > 0
                ? `${proj.late_project_penalty_percent_per_day}% per day`
                : "None by default"
            }
          />
        </PolicySection>

        <PolicySection
          title="Assessment defaults"
          description="Course-wide quiz and exam settings (individual assessments may override)"
          icon={ClipboardList}
        >
          <PolicyRow label="Retakes enabled by default" value={yesNo(retakes.retake_enabled_default)} />
          {retakes.retake_enabled_default ? (
            <>
              <PolicyRow
                label="Retake limit"
                value={retakes.retake_limit_default > 0 ? retakes.retake_limit_default : "Unlimited"}
              />
              <PolicyRow label="Scored attempt" value={retakePolicyLabel(retakes.retake_policy_default)} />
              <PolicyRow label="Review before retake" value={yesNo(retakes.review_before_retake_default)} />
            </>
          ) : null}
          <PolicyRow label="Strict proctoring mode" value={yesNo(integrity.strict_mode_default)} />
          <PolicyRow label="Block copy / paste" value={yesNo(integrity.block_copy_paste_default)} />
          <PolicyRow label="Track tab switches" value={yesNo(integrity.track_tab_switches_default)} />
          {integrity.track_tab_switches_default ? (
            <PolicyRow label="Max tab switches" value={integrity.max_tab_switches_default} />
          ) : null}
          <PolicyRow label="Require fullscreen" value={yesNo(integrity.require_fullscreen_default)} />
          <PolicyRow label="Assessment superpowers" value={yesNo(assess.superpowers.enable_superpowers_default)} />
        </PolicySection>
      </div>

      <PolicySection
        title="Playground"
        description="Live classroom session defaults"
        icon={FlaskConical}
      >
        <PolicyRow label="Default session length" value={`${data.playground_policy.default_duration_sec} sec / question`} />
        <PolicyRow label="Default question count" value={data.playground_policy.default_question_count} />
        <PolicyRow
          label="Points per correct"
          value={`${data.playground_policy.points_per_correct_min}–${data.playground_policy.points_per_correct_max}`}
        />
        <PolicyRow label="Student nicknames" value={yesNo(data.playground_policy.allow_student_nicknames)} />
        <PolicyRow
          label="Leaderboard accuracy"
          value={yesNo(data.playground_policy.show_accuracy_on_leaderboard)}
        />
        <PolicyRow
          label="Playground leaderboard privacy"
          value={data.playground_policy.blur_leaderboard_peer_names ? "Peer names hidden" : "Peer names visible"}
        />
        <PolicyRow label="Sync engagement points" value={yesNo(data.playground_policy.sync_engagement_points)} />
      </PolicySection>

      <PolicySection
        title="Practice Hub"
        description="Self-paced practice, XP, and leaderboard settings"
        icon={Brain}
      >
        <PolicyRow
          label="Leaderboard privacy"
          value={data.practice_hub_policy.blur_leaderboard_peer_names ? "Peer names hidden" : "Peer names visible"}
        />
        <PolicyRow
          label="Scholar leaderboard access"
          value={data.practice_hub_policy.scholar_leaderboard_access ? "Enabled" : "Membership required"}
        />
        <PolicyRow
          label="Scholar daily cap"
          value={
            data.practice_hub_policy.scholar_daily_question_cap < 0
              ? "Unlimited"
              : `${data.practice_hub_policy.scholar_daily_question_cap} questions/day`
          }
        />
        <PolicyRow
          label="Explorer daily cap"
          value={
            data.practice_hub_policy.explorer_daily_question_cap < 0
              ? "Unlimited"
              : `${data.practice_hub_policy.explorer_daily_question_cap} questions/day`
          }
        />
        <PolicyRow label="XP per level" value={data.practice_hub_policy.xp_per_level} />
        <PolicyRow
          label="Points per question"
          value={`Easy ${data.practice_hub_policy.points_easy} · Medium ${data.practice_hub_policy.points_medium} · Hard ${data.practice_hub_policy.points_hard}`}
        />
      </PolicySection>

      <div className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3 text-xs text-[var(--cc-text-muted)]">
        <BookOpen className="h-4 w-4 shrink-0 mt-0.5 text-[var(--cc-accent-dark)]" aria-hidden />
        <p>
          These are course defaults from your instructor. Individual quizzes, homework, and projects may use different
          settings — check each assignment for deadlines and attempt limits.
          {data.updated_at ? (
            <>
              {" "}
              Last updated{" "}
              {new Date(data.updated_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              .
            </>
          ) : null}
        </p>
      </div>

      <MembershipDisclaimer variant="student" showTitle />
    </div>
  )
}
