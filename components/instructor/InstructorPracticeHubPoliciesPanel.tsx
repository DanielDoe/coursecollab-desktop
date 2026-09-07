"use client"

import type { ReactNode } from "react"
import { Eye, EyeOff, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  InstructorPolicyDividedList,
  InstructorPolicySurfaceCard,
  InstructorPolicyToggleRow,
} from "@/components/instructor/InstructorPolicySurfaceCard"
import { useInstructorPracticeHubPolicy } from "@/components/instructor/useInstructorPracticeHubPolicy"
import type { PracticeHubPolicy } from "@/lib/practice-hub-policy-settings"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const FIELD = cn("h-10 rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)
const FIELD_SM = cn("h-10 w-full rounded-lg border shadow-none sm:w-24", CC_FIELD.base, CC_FIELD.focus)

type Props = {
  bare?: boolean
  showSaveButton?: boolean
  onPolicyApplied?: (policy: PracticeHubPolicy) => void
  policyState?: ReturnType<(typeof useInstructorPracticeHubPolicy)>
  headerSlot?: ReactNode
  footerSlot?: ReactNode
}

function PolicyBlock({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-4 border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0">
      <div>
        <h4 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</h4>
        {description ? <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

function NumField({
  id,
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  className,
}: {
  id?: string
  label: string
  hint?: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={FIELD_SM}
      />
      {hint ? <p className={cn("text-[11px] leading-relaxed", PORTAL_TEXT_MUTED)}>{hint}</p> : null}
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  switchClass,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  switchClass?: string
  icon?: ReactNode
}) {
  return (
    <InstructorPolicyToggleRow
      label={label}
      hint={description}
      checked={checked}
      onCheckedChange={onCheckedChange}
      switchClass={switchClass}
    />
  )
}

export function InstructorPracticeHubPoliciesPanel({
  bare = false,
  showSaveButton = true,
  onPolicyApplied,
  policyState,
  headerSlot,
  footerSlot,
}: Props) {
  const internal = useInstructorPracticeHubPolicy()
  const { policy, setPolicy, loading, saving, save } = policyState ?? internal
  const chrome = facultyEmbedChrome(bare ? "practice-rules" : "practice")
  const spinner = facultyModuleSpinnerClass(bare ? "practice-rules" : "practice")
  const switchClass = chrome.switchChecked

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-10 text-sm", PORTAL_TEXT_MUTED)}>
        <Loader2 className={cn("mr-2 h-5 w-5 animate-spin", spinner)} />
        Loading practice rules…
      </div>
    )
  }

  const handleSave = async () => {
    const ok = await save()
    if (ok) onPolicyApplied?.(policy)
    return ok
  }

  const content = (
    <>
      {headerSlot}

      <PolicyBlock
        title="Membership limits"
        description="Daily question caps and max questions per session by membership tier. Use −1 for unlimited daily cap."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] p-3 space-y-3">
            <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Scholar (free)</p>
            <NumField
              id="ph-scholar-daily"
              label="Daily question cap"
              hint="Questions per day"
              value={policy.scholar_daily_question_cap}
              onChange={(n) => setPolicy((p) => ({ ...p, scholar_daily_question_cap: n }))}
              min={-1}
              max={500}
            />
            <NumField
              id="ph-scholar-session"
              label="Max per session"
              value={policy.scholar_max_questions_per_session}
              onChange={(n) => setPolicy((p) => ({ ...p, scholar_max_questions_per_session: n }))}
              min={1}
              max={policy.max_questions_per_session}
            />
          </div>
          <div className="rounded-xl border border-[var(--border)] p-3 space-y-3">
            <p className={cn("text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400")}>
              Explorer
            </p>
            <NumField
              id="ph-explorer-daily"
              label="Daily question cap"
              value={policy.explorer_daily_question_cap}
              onChange={(n) => setPolicy((p) => ({ ...p, explorer_daily_question_cap: n }))}
              min={-1}
              max={500}
            />
            <NumField
              id="ph-explorer-session"
              label="Max per session"
              value={policy.explorer_max_questions_per_session}
              onChange={(n) => setPolicy((p) => ({ ...p, explorer_max_questions_per_session: n }))}
              min={1}
              max={policy.max_questions_per_session}
            />
          </div>
          <div className="rounded-xl border border-[var(--border)] p-3 space-y-3">
            <p className={cn("text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400")}>
              Trailblazer
            </p>
            <NumField
              id="ph-trail-daily"
              label="Daily question cap"
              value={policy.trailblazer_daily_question_cap}
              onChange={(n) => setPolicy((p) => ({ ...p, trailblazer_daily_question_cap: n }))}
              min={-1}
              max={500}
            />
            <NumField
              id="ph-trail-session"
              label="Max per session"
              value={policy.trailblazer_max_questions_per_session}
              onChange={(n) => setPolicy((p) => ({ ...p, trailblazer_max_questions_per_session: n }))}
              min={1}
              max={policy.max_questions_per_session}
            />
          </div>
        </div>
      </PolicyBlock>

      <PolicyBlock title="Session defaults" description="Baseline question counts for all tiers (tier caps still apply).">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField
            id="ph-default-q"
            label="Default questions"
            value={policy.default_questions_per_session}
            onChange={(n) => setPolicy((p) => ({ ...p, default_questions_per_session: n }))}
            min={policy.min_questions_per_session}
            max={policy.max_questions_per_session}
          />
          <NumField
            id="ph-min-q"
            label="Minimum"
            value={policy.min_questions_per_session}
            onChange={(n) => setPolicy((p) => ({ ...p, min_questions_per_session: n }))}
            min={1}
            max={policy.max_questions_per_session}
          />
          <NumField
            id="ph-max-q"
            label="Absolute max"
            value={policy.max_questions_per_session}
            onChange={(n) => setPolicy((p) => ({ ...p, max_questions_per_session: n }))}
            min={policy.min_questions_per_session}
            max={200}
          />
        </div>
      </PolicyBlock>

      <PolicyBlock title="XP & scoring" description="Points per correct answer, speed bonuses, and leaderboard XP multiplier.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumField
            id="ph-pts-easy"
            label="Points (easy)"
            value={policy.points_easy}
            onChange={(n) => setPolicy((p) => ({ ...p, points_easy: n }))}
            min={1}
            max={100}
          />
          <NumField
            id="ph-pts-med"
            label="Points (medium)"
            value={policy.points_medium}
            onChange={(n) => setPolicy((p) => ({ ...p, points_medium: n }))}
            min={1}
            max={100}
          />
          <NumField
            id="ph-pts-hard"
            label="Points (hard)"
            value={policy.points_hard}
            onChange={(n) => setPolicy((p) => ({ ...p, points_hard: n }))}
            min={1}
            max={100}
          />
          <NumField
            id="ph-xp-mult"
            label="XP multiplier"
            hint="Final XP = total × multiplier"
            value={policy.xp_multiplier}
            onChange={(n) => setPolicy((p) => ({ ...p, xp_multiplier: n }))}
            min={1}
            max={10}
            step={0.5}
          />
          <NumField
            id="ph-speed-max"
            label="Speed bonus max"
            value={policy.speed_bonus_max}
            onChange={(n) => setPolicy((p) => ({ ...p, speed_bonus_max: n }))}
            min={0}
            max={50}
          />
          <NumField
            id="ph-speed-ms"
            label="Speed window (ms)"
            value={policy.speed_bonus_window_ms}
            onChange={(n) => setPolicy((p) => ({ ...p, speed_bonus_window_ms: n }))}
            min={1000}
            max={120000}
            step={500}
          />
          <NumField
            id="ph-first-bonus"
            label="First-attempt bonus"
            value={policy.first_attempt_bonus}
            onChange={(n) => setPolicy((p) => ({ ...p, first_attempt_bonus: n }))}
            min={0}
            max={50}
          />
          <NumField
            id="ph-xp-level"
            label="XP per level"
            value={policy.xp_per_level}
            onChange={(n) => setPolicy((p) => ({ ...p, xp_per_level: n }))}
            min={100}
            max={10000}
            step={50}
          />
        </div>
      </PolicyBlock>

      <PolicyBlock
        title="Engagement & Trade Center"
        description="Weekly activity points synced from completed practice sessions."
      >
        <div className="space-y-3">
          <InstructorPolicyDividedList>
          <ToggleRow
            label="Sync to engagement points"
            description="Award Trade Center activity credit when students complete practice."
            checked={policy.sync_engagement_points}
            onCheckedChange={(checked) => setPolicy((p) => ({ ...p, sync_engagement_points: checked }))}
            switchClass={switchClass}
          />
          </InstructorPolicyDividedList>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumField
              id="ph-eng-base"
              label="Base points per session"
              value={policy.engagement_base_per_attempt}
              onChange={(n) => setPolicy((p) => ({ ...p, engagement_base_per_attempt: n }))}
              min={0}
              max={50}
            />
            <NumField
              id="ph-eng-div"
              label="Score bonus divisor"
              hint="Bonus = session score ÷ divisor"
              value={policy.engagement_score_divisor}
              onChange={(n) => setPolicy((p) => ({ ...p, engagement_score_divisor: n }))}
              min={1}
              max={100}
            />
          </div>
        </div>
      </PolicyBlock>

      <PolicyBlock title="Learning experience">
        <div className="space-y-3">
          <InstructorPolicyDividedList>
          <ToggleRow
            label="Allow hints"
            description="Students can reveal hints during practice (when available on the question)."
            checked={policy.allow_hints}
            onCheckedChange={(checked) => setPolicy((p) => ({ ...p, allow_hints: checked }))}
            switchClass={switchClass}
          />
          <ToggleRow
            label="Show explanations after wrong answers"
            description="Display review feedback immediately after incorrect submissions."
            checked={policy.show_explanations_after_wrong}
            onCheckedChange={(checked) => setPolicy((p) => ({ ...p, show_explanations_after_wrong: checked }))}
            switchClass={switchClass}
          />
          </InstructorPolicyDividedList>
          <NumField
            id="ph-max-attempts"
            label="Max attempts per question"
            hint="0 = unlimited retries in one session"
            value={policy.max_attempts_per_question}
            onChange={(n) => setPolicy((p) => ({ ...p, max_attempts_per_question: n }))}
            min={0}
            max={10}
            className="max-w-xs"
          />
        </div>
      </PolicyBlock>

      <PolicyBlock title="Leaderboard & privacy" description="Visibility, FERPA-style blur, and Scholar tier access.">
        <InstructorPolicyDividedList>
          <ToggleRow
            label="Blur peer names & scores"
            description={
              policy.blur_leaderboard_peer_names
                ? "Students only see their own row on Practice Hub leaderboards."
                : "Students see full rankings with names and points (default)."
            }
            checked={policy.blur_leaderboard_peer_names}
            onCheckedChange={(checked) => setPolicy((p) => ({ ...p, blur_leaderboard_peer_names: checked }))}
            switchClass={switchClass}
            icon={
              policy.blur_leaderboard_peer_names ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />
            }
          />
          <ToggleRow
            label="Allow Scholar tier on leaderboard"
            description="Override membership: free Scholar students can view rankings when enabled."
            checked={policy.scholar_leaderboard_access}
            onCheckedChange={(checked) => setPolicy((p) => ({ ...p, scholar_leaderboard_access: checked }))}
            switchClass={switchClass}
          />
          <ToggleRow
            label="Show accuracy on leaderboard"
            description="Display average score % alongside XP on ranking cards."
            checked={policy.show_accuracy_on_leaderboard}
            onCheckedChange={(checked) => setPolicy((p) => ({ ...p, show_accuracy_on_leaderboard: checked }))}
            switchClass={switchClass}
          />
          <ToggleRow
            label="Show response time on leaderboard"
            description="Display average time-per-question when data is available."
            checked={policy.show_response_time_on_leaderboard}
            onCheckedChange={(checked) =>
              setPolicy((p) => ({ ...p, show_response_time_on_leaderboard: checked }))
            }
            switchClass={switchClass}
          />
        </InstructorPolicyDividedList>
      </PolicyBlock>

      {footerSlot}

      {showSaveButton ? (
        <div className="flex justify-end border-t border-[var(--border)] pt-5">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className={cn("h-9 rounded-lg", chrome.cta)}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save practice rules
          </Button>
        </div>
      ) : null}
    </>
  )

  if (bare) return content

  return (
    <InstructorPolicySurfaceCard title="Practice Hub rules" description="Course-wide Practice Hub settings">
      {content}
    </InstructorPolicySurfaceCard>
  )
}

export { useInstructorPracticeHubPolicy }
