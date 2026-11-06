"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { BookMarked, ClipboardPaste, Eye, Keyboard, Maximize, Shield, Sparkles, Upload, Users } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { ProjectIntegritySettings } from "@/lib/projects/project-integrity-types"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import type { FacultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { projectFormSelectTriggerClass } from "@/components/instructor/projects/project-form-ui"

function PolicyRow({
  chrome,
  icon: Icon,
  title,
  description,
  control,
  children,
}: {
  chrome: FacultyEmbedChrome
  icon: LucideIcon
  title: string
  description: string
  control: ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-muted/20 px-4 py-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 gap-3">
          <div
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
              chrome.p.softBg,
              chrome.p.iconText,
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{title}</p>
            <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{description}</p>
          </div>
        </div>
        <div className="shrink-0 pt-0.5">{control}</div>
      </div>
      {children ? <div className="mt-3 ml-12">{children}</div> : null}
    </div>
  )
}

export function ProjectIntegritySettingsForm({
  value,
  onChange,
  disabled,
  chrome: chromeProp,
}: {
  value: ProjectIntegritySettings
  onChange: (next: ProjectIntegritySettings) => void
  disabled?: boolean
  chrome?: FacultyEmbedChrome
}) {
  const chrome = chromeProp ?? facultyEmbedChrome("projects")
  const patch = (p: Partial<ProjectIntegritySettings>) => onChange({ ...value, ...p })

  return (
    <div className="space-y-4">
      <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", chrome.p.border, chrome.p.softBg)}>
        <Shield className={cn("mt-0.5 h-4 w-4 shrink-0", chrome.p.iconText)} strokeWidth={2} />
        <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
          {value.disclaimer ||
            "Logged paste, focus, and Cora use. Deterrence only — not a guarantee of academic integrity."}
        </p>
      </div>

      <div className={cn("overflow-hidden rounded-xl border", chrome.p.border)}>
        <div className={cn("flex items-center justify-between gap-4 border-b px-4 py-3.5", chrome.p.softBg)}>
          <div className="flex min-w-0 items-center gap-3">
            <div className={chrome.iconBadge("sm")}>
              <Shield className="h-4 w-4 !text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Strict mode</p>
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                {value.strict_mode ? "Workspace controls below are enforced." : "Configure controls, then enable."}
              </p>
            </div>
          </div>
          <Switch
            disabled={disabled}
            checked={value.strict_mode}
            onCheckedChange={(c) => patch({ strict_mode: c })}
            className={chrome.switchChecked}
          />
        </div>

        <div className="space-y-3 p-4">
          <PolicyRow
            chrome={chrome}
            icon={ClipboardPaste}
            title="Copy / paste"
            description="Allowed, tracked in the integrity log, or blocked in the workspace."
            control={
              <Select
                disabled={disabled}
                value={value.copy_paste}
                onValueChange={(v) => patch({ copy_paste: v as ProjectIntegritySettings["copy_paste"] })}
              >
                <SelectTrigger className={cn(projectFormSelectTriggerClass, "h-9 w-[140px]")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allowed">Allowed</SelectItem>
                  <SelectItem value="tracked">Tracked</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <PolicyRow
            chrome={chrome}
            icon={ClipboardPaste}
            title="Log paste events"
            description="Keep a paste log even when copy/paste is allowed."
            control={
              <Switch
                disabled={disabled}
                checked={value.track_paste}
                onCheckedChange={(c) => patch({ track_paste: c })}
                className={chrome.switchChecked}
              />
            }
          />
          <PolicyRow
            chrome={chrome}
            icon={Keyboard}
            title="Track editing activity"
            description="Record typing vs paste bursts in the workspace for review."
            control={
              <Switch
                disabled={disabled}
                checked={value.track_editing_activity}
                onCheckedChange={(c) => patch({ track_editing_activity: c })}
                className={chrome.switchChecked}
              />
            }
          />
          <PolicyRow
            chrome={chrome}
            icon={Eye}
            title="Track tab and focus switches"
            description="Log when students leave the project workspace."
            control={
              <Switch
                disabled={disabled}
                checked={value.track_focus}
                onCheckedChange={(c) => patch({ track_focus: c })}
                className={chrome.switchChecked}
              />
            }
          />
          <PolicyRow
            chrome={chrome}
            icon={Maximize}
            title="Prefer fullscreen"
            description="Prompt students to stay in fullscreen while working."
            control={
              <Switch
                disabled={disabled}
                checked={value.prefer_fullscreen}
                onCheckedChange={(c) => patch({ prefer_fullscreen: c })}
                className={chrome.switchChecked}
              />
            }
          />
          <PolicyRow
            chrome={chrome}
            icon={Sparkles}
            title="Cora"
            description="Off, guided (tutor only), or full assistant access in the workspace."
            control={
              <Select
                disabled={disabled}
                value={value.cora_policy}
                onValueChange={(v) => patch({ cora_policy: v as ProjectIntegritySettings["cora_policy"] })}
              >
                <SelectTrigger className={cn(projectFormSelectTriggerClass, "h-9 w-[140px]")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="guided">Guided</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <PolicyRow
            chrome={chrome}
            icon={BookMarked}
            title="Require citations"
            description="Students must attach sources on report sections that need them."
            control={
              <Switch
                disabled={disabled}
                checked={value.require_citations}
                onCheckedChange={(c) => patch({ require_citations: c })}
                className={chrome.switchChecked}
              />
            }
          />
          <PolicyRow
            chrome={chrome}
            icon={Keyboard}
            title="Require in-workspace editing"
            description="Report body must be written in CourseCollab, not only uploaded."
            control={
              <Switch
                disabled={disabled}
                checked={value.require_workspace_editing}
                onCheckedChange={(c) => patch({ require_workspace_editing: c })}
                className={chrome.switchChecked}
              />
            }
          />
          <PolicyRow
            chrome={chrome}
            icon={Upload}
            title="External uploads"
            description="Allow, restrict to evidence files, or block outside-workspace uploads."
            control={
              <Select
                disabled={disabled}
                value={value.external_upload_policy}
                onValueChange={(v) =>
                  patch({ external_upload_policy: v as ProjectIntegritySettings["external_upload_policy"] })
                }
              >
                <SelectTrigger className={cn(projectFormSelectTriggerClass, "h-9 w-[140px]")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allowed">Allowed</SelectItem>
                  <SelectItem value="restricted">Restricted</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <PolicyRow
            chrome={chrome}
            icon={Users}
            title="Group confirmation"
            description="Every member must confirm before the group submits."
            control={
              <Switch
                disabled={disabled}
                checked={value.require_group_confirmation}
                onCheckedChange={(c) => patch({ require_group_confirmation: c })}
                className={chrome.switchChecked}
              />
            }
          />
        </div>
      </div>
    </div>
  )
}