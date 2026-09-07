"use client"

import { Eye, EyeOff, Gamepad2, Loader2, Save, Timer, Users, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  InstructorPolicyDividedList,
  InstructorPolicySurfaceCard,
  InstructorPolicyToggleRow,
} from "@/components/instructor/InstructorPolicySurfaceCard"
import { useInstructorPlaygroundPolicy } from "@/components/instructor/useInstructorPlaygroundPolicy"
import type { PlaygroundPolicy } from "@/lib/playground-policy-settings"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const FIELD = cn("h-10 rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)
const FIELD_SM = cn("h-10 w-24 rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)

function PolicyBlock({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
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
        className={FIELD}
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

type Props = {
  availableClassSessions?: Array<{ id: number; code: string; description?: string }>
  compact?: boolean
  bare?: boolean
  onPolicyApplied?: (policy: PlaygroundPolicy) => void
  policyState?: ReturnType<typeof useInstructorPlaygroundPolicy>
}

export function InstructorPlaygroundPoliciesPanel({
  availableClassSessions = [],
  compact = false,
  bare = false,
  onPolicyApplied,
  policyState,
}: Props) {
  const internal = useInstructorPlaygroundPolicy()
  const { policy, setPolicy, loading, saving, save } = policyState ?? internal
  const chrome = facultyEmbedChrome(bare ? "playground-rules" : "playground")
  const spinner = facultyModuleSpinnerClass(bare ? "playground-rules" : "playground")
  const switchClass = chrome.switchChecked

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-10 text-sm", PORTAL_TEXT_MUTED)}>
        <Loader2 className={cn("mr-2 h-5 w-5 animate-spin", spinner)} />
        Loading playground rules…
      </div>
    )
  }

  const toggleSessionDefault = (sessionId: number) => {
    setPolicy((prev) => {
      const ids = prev.default_allowed_session_ids.includes(sessionId)
        ? prev.default_allowed_session_ids.filter((id) => id !== sessionId)
        : [...prev.default_allowed_session_ids, sessionId]
      return { ...prev, default_allowed_session_ids: ids }
    })
  }

  const handleSave = async () => {
    const ok = await save()
    if (ok) onPolicyApplied?.(policy)
  }

  const scoringToggles = [
    {
      key: "sync_engagement_points" as const,
      label: "Sync scores to engagement points",
      description: "Award trade-center / engagement credit when sessions complete.",
    },
    {
      key: "allow_student_nicknames" as const,
      label: "Allow nicknames on leaderboard",
      description: "Students may use a display nickname instead of legal name when unblurred.",
    },
    {
      key: "show_accuracy_on_leaderboard" as const,
      label: "Show accuracy on leaderboard",
      description: "Display correct/total breakdown when leaderboard is visible.",
    },
    {
      key: "require_session_restriction" as const,
      label: "Require class section selection",
      description: "Instructors must pick which sections can join each lobby.",
    },
  ]

  const bareContent = (
    <>
      <PolicyBlock
        title="Leaderboard privacy (FERPA)"
        description="Control what students see on classroom playground leaderboards."
      >
        <InstructorPolicyDividedList>
          <InstructorPolicyToggleRow
            label="Blur peer names & scores"
            hint={
              policy.blur_leaderboard_peer_names
                ? "Students only see their own row on live leaderboards."
                : "Students see full rankings with names and points. Turn on to blur peers."
            }
            checked={policy.blur_leaderboard_peer_names}
            onCheckedChange={(checked) =>
              setPolicy((prev) => ({ ...prev, blur_leaderboard_peer_names: checked }))
            }
            switchClass={switchClass}
          />
        </InstructorPolicyDividedList>
      </PolicyBlock>

      <PolicyBlock
        title="Session defaults"
        description="Starting values when you open a new classroom playground lobby."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <NumField
            id="pg-default-questions"
            label="Default question count"
            value={policy.default_question_count}
            onChange={(n) => setPolicy((prev) => ({ ...prev, default_question_count: n }))}
            min={1}
            max={policy.max_questions_per_session}
          />
          <NumField
            id="pg-default-duration"
            label="Default seconds per question"
            value={policy.default_duration_sec}
            onChange={(n) => setPolicy((prev) => ({ ...prev, default_duration_sec: n }))}
            min={policy.min_duration_sec}
            max={policy.max_duration_sec}
          />
          <NumField
            id="pg-max-questions"
            label="Max questions per session"
            value={policy.max_questions_per_session}
            onChange={(n) => setPolicy((prev) => ({ ...prev, max_questions_per_session: n }))}
            min={1}
            max={200}
          />
          <NumField
            id="pg-live-cap"
            label="Max live sessions"
            value={policy.max_concurrent_live_sessions}
            onChange={(n) => setPolicy((prev) => ({ ...prev, max_concurrent_live_sessions: n }))}
            min={1}
            max={5}
          />
        </div>
        <div className="space-y-1.5">
          <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Time limits (seconds per question)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={3}
              max={policy.max_duration_sec}
              value={policy.min_duration_sec}
              onChange={(e) => setPolicy((prev) => ({ ...prev, min_duration_sec: Number(e.target.value) }))}
              className={FIELD_SM}
            />
            <span className={cn("text-sm", PORTAL_TEXT_MUTED)}>to</span>
            <Input
              type="number"
              min={policy.min_duration_sec}
              max={600}
              value={policy.max_duration_sec}
              onChange={(e) => setPolicy((prev) => ({ ...prev, max_duration_sec: Number(e.target.value) }))}
              className={FIELD_SM}
            />
          </div>
        </div>
      </PolicyBlock>

      <PolicyBlock
        title="Scoring & engagement"
        description="Speed-based points and how results flow into engagement and the trade center."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField
            id="pg-points-max"
            label="Max points per correct answer"
            value={policy.points_per_correct_max}
            onChange={(n) => setPolicy((prev) => ({ ...prev, points_per_correct_max: n }))}
            min={1}
            max={100}
          />
          <NumField
            id="pg-points-min"
            label="Min points per correct answer"
            value={policy.points_per_correct_min}
            onChange={(n) => setPolicy((prev) => ({ ...prev, points_per_correct_min: n }))}
            min={0}
            max={policy.points_per_correct_max}
          />
          <NumField
            id="pg-speed-window"
            label="Speed bonus window (ms)"
            value={policy.speed_bonus_window_ms}
            onChange={(n) => setPolicy((prev) => ({ ...prev, speed_bonus_window_ms: n }))}
            min={1000}
            max={120000}
            step={500}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1 border-[var(--border)] bg-muted/50 text-[var(--cc-text-muted)]">
            <Zap className="h-3 w-3" />
            Fast answer ≈ {policy.points_per_correct_max} pts
          </Badge>
          <Badge variant="outline" className="gap-1 border-[var(--border)] bg-muted/50 text-[var(--cc-text-muted)]">
            <Timer className="h-3 w-3" />
            Slow answer ≈ {policy.points_per_correct_min} pts
          </Badge>
        </div>

        <InstructorPolicyDividedList>
          {scoringToggles.map(({ key, label, description }) => (
            <ToggleRow
              key={key}
              label={label}
              description={description}
              checked={policy[key]}
              onCheckedChange={(checked) => setPolicy((prev) => ({ ...prev, [key]: checked }))}
              switchClass={switchClass}
            />
          ))}
        </InstructorPolicyDividedList>
      </PolicyBlock>

      {!compact && availableClassSessions.length > 0 ? (
        <PolicyBlock
          title="Default section access"
          description="Pre-select class sections when starting a lobby. Empty means all sections."
        >
          <div className="flex flex-wrap gap-1.5">
            {availableClassSessions.map((session) => {
              const selected = policy.default_allowed_session_ids.includes(session.id)
              return (
                <Button
                  key={session.id}
                  type="button"
                  variant="ghost"
                  className={cn("h-auto gap-1.5 rounded-lg px-3 py-2", selected ? chrome.solid : chrome.quiet)}
                  onClick={() => toggleSessionDefault(session.id)}
                >
                  <Users className="h-3.5 w-3.5" />
                  {session.code}
                </Button>
              )
            })}
          </div>
        </PolicyBlock>
      ) : null}

      <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
        <p className={cn("flex items-center gap-1.5 text-xs", PORTAL_TEXT_MUTED)}>
          <Gamepad2 className="h-3.5 w-3.5" />
          {policy.default_question_count} Q · {policy.default_duration_sec}s · {policy.points_per_correct_min}–
          {policy.points_per_correct_max} pts
        </p>
        <Button
          type="button"
          size="sm"
          disabled={saving}
          className={cn("h-9 gap-2 rounded-lg", chrome.cta)}
          onClick={() => void handleSave()}
        >
          {saving ? <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> : <Save className="h-4 w-4" />}
          Save playground rules
        </Button>
      </div>
    </>
  )

  if (bare) return bareContent

  return (
    <div className="space-y-4">
      <InstructorPolicySurfaceCard
        title="Leaderboard privacy (FERPA)"
        description="Control what students see on classroom playground leaderboards."
      >
        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn("shrink-0 rounded-xl p-2", chrome.p.softBg)}>
              {policy.blur_leaderboard_peer_names ? (
                <EyeOff className={cn("h-5 w-5", chrome.p.iconText)} />
              ) : (
                <Eye className={cn("h-5 w-5", chrome.p.iconText)} />
              )}
            </div>
            <div>
              <Label className="font-medium">Blur peer names & scores</Label>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {policy.blur_leaderboard_peer_names
                  ? "Students only see their own row on live leaderboards (FERPA-style)."
                  : "Students see full rankings with names and points (default). Turn on to blur peers."}
              </p>
            </div>
          </div>
          <Switch
            checked={policy.blur_leaderboard_peer_names}
            onCheckedChange={(checked) =>
              setPolicy((prev) => ({ ...prev, blur_leaderboard_peer_names: checked }))
            }
            className={switchClass}
          />
        </div>
      </InstructorPolicySurfaceCard>

      <InstructorPolicySurfaceCard
        title="Session defaults"
        description="Starting values when you open a new classroom playground lobby."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumField
            id="pg-default-questions"
            label="Default question count"
            value={policy.default_question_count}
            onChange={(n) => setPolicy((prev) => ({ ...prev, default_question_count: n }))}
            min={1}
            max={policy.max_questions_per_session}
          />
          <NumField
            id="pg-default-duration"
            label="Default seconds / question"
            value={policy.default_duration_sec}
            onChange={(n) => setPolicy((prev) => ({ ...prev, default_duration_sec: n }))}
            min={policy.min_duration_sec}
            max={policy.max_duration_sec}
          />
          <NumField
            id="pg-max-questions"
            label="Max questions / session"
            value={policy.max_questions_per_session}
            onChange={(n) => setPolicy((prev) => ({ ...prev, max_questions_per_session: n }))}
            min={1}
            max={200}
          />
          <NumField
            id="pg-live-cap"
            label="Max live sessions"
            value={policy.max_concurrent_live_sessions}
            onChange={(n) => setPolicy((prev) => ({ ...prev, max_concurrent_live_sessions: n }))}
            min={1}
            max={5}
          />
        </div>
      </InstructorPolicySurfaceCard>

      <InstructorPolicySurfaceCard
        title="Scoring & engagement"
        description="Speed-based points and how results flow into engagement/trade center."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField
            id="pg-points-max"
            label="Max points / correct answer"
            value={policy.points_per_correct_max}
            onChange={(n) => setPolicy((prev) => ({ ...prev, points_per_correct_max: n }))}
            min={1}
            max={100}
          />
          <NumField
            id="pg-points-min"
            label="Min points / correct answer"
            value={policy.points_per_correct_min}
            onChange={(n) => setPolicy((prev) => ({ ...prev, points_per_correct_min: n }))}
            min={0}
            max={policy.points_per_correct_max}
          />
          <NumField
            id="pg-speed-window"
            label="Speed bonus window (ms)"
            value={policy.speed_bonus_window_ms}
            onChange={(n) => setPolicy((prev) => ({ ...prev, speed_bonus_window_ms: n }))}
            min={1000}
            max={120000}
            step={500}
          />
        </div>
        <InstructorPolicyDividedList>
          {scoringToggles.map(({ key, label, description }) => (
            <ToggleRow
              key={key}
              label={label}
              description={description}
              checked={policy[key]}
              onCheckedChange={(checked) => setPolicy((prev) => ({ ...prev, [key]: checked }))}
              switchClass={switchClass}
            />
          ))}
        </InstructorPolicyDividedList>
      </InstructorPolicySurfaceCard>

      {!compact && availableClassSessions.length > 0 ? (
        <InstructorPolicySurfaceCard
          title="Default section access"
          description="Pre-select class sections when starting a lobby. Empty = all sections."
        >
          <div className="flex flex-wrap gap-2">
            {availableClassSessions.map((session) => {
              const selected = policy.default_allowed_session_ids.includes(session.id)
              return (
                <Button
                  key={session.id}
                  type="button"
                  size="sm"
                  variant={selected ? "default" : "outline"}
                  onClick={() => toggleSessionDefault(session.id)}
                  className={selected ? chrome.cta : chrome.outline}
                >
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  {session.code}
                </Button>
              )
            })}
          </div>
        </InstructorPolicySurfaceCard>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void handleSave()} disabled={saving} className={cn("gap-2 rounded-xl", chrome.cta)}>
          {saving ? <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> : <Save className="h-4 w-4" />}
          Save playground rules
        </Button>
      </div>
    </div>
  )
}
