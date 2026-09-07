"use client"

import { useMemo } from "react"
import {
  BarChart3,
  Calendar,
  ClipboardList,
  Flame,
  GraduationCap,
  LayoutGrid,
  LayoutTemplate,
  Lightbulb,
  RotateCcw,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DashboardLayoutState, DashboardPortal, DashboardRoleKey, DashboardWidgetDef } from "@/lib/dashboard-v2/types"
import {
  getEligibleWidgets,
  getTemplatesForRole,
  getWidgetDef,
} from "@/lib/dashboard-v2/widget-registry"
import { STUDENT_CUSTOMIZE_THEME, STUDENT_DASHBOARD_KPI_THUMBS, solidListThumb } from "@/lib/student-color-hunt-theme"
import type { SolidListThumb } from "@/lib/student-color-hunt-theme"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"

const KPI_WIDGET_THUMBS: Record<string, SolidListThumb> = {
  "kpi-student-overall-grade": STUDENT_DASHBOARD_KPI_THUMBS.overallGrade,
  "kpi-student-quiz-average": STUDENT_DASHBOARD_KPI_THUMBS.quizAverage,
  "kpi-student-homework-average": STUDENT_DASHBOARD_KPI_THUMBS.homeworkAverage,
  "kpi-student-attendance": STUDENT_DASHBOARD_KPI_THUMBS.attendance,
  "kpi-student-missing-work": STUDENT_DASHBOARD_KPI_THUMBS.missingWork,
  "kpi-student-streak": STUDENT_DASHBOARD_KPI_THUMBS.streak,
  "kpi-student-classroom-points": STUDENT_DASHBOARD_KPI_THUMBS.classroomPoints,
  "kpi-student-deadlines": STUDENT_DASHBOARD_KPI_THUMBS.upcoming,
}

const WIDGET_ICONS: Record<string, LucideIcon> = {
  "kpi-student-overall-grade": GraduationCap,
  "kpi-student-quiz-average": ClipboardList,
  "kpi-student-homework-average": LayoutGrid,
  "kpi-student-attendance": Calendar,
  "kpi-student-missing-work": ClipboardList,
  "kpi-student-streak": Flame,
  "kpi-student-classroom-points": Trophy,
  "kpi-student-deadlines": Calendar,
  "chart-student-grade-trend": BarChart3,
  "chart-student-class-comparison": BarChart3,
  "panel-student-insights": Lightbulb,
  "panel-student-engagement": Zap,
}

function widgetVisual(widgetId: string, index: number) {
  return {
    thumb: KPI_WIDGET_THUMBS[widgetId] ?? solidListThumb(index),
    icon: WIDGET_ICONS[widgetId] ?? LayoutTemplate,
  }
}

export function DashboardCustomizeDialog({
  open,
  onOpenChange,
  portal,
  role,
  layout,
  onApplyTemplate,
  onToggleWidget,
  onReset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  portal: DashboardPortal
  role: DashboardRoleKey
  layout: DashboardLayoutState
  onApplyTemplate: (templateId: string) => void
  onToggleWidget: (widgetId: string) => void
  onReset: () => void
}) {
  const templates = getTemplatesForRole(role)
  const eligible = useMemo(() => getEligibleWidgets(portal, role), [portal, role])
  const activeTemplate = templates.find((t) => t.id === layout.templateId)
  const theme = STUDENT_CUSTOMIZE_THEME

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto border-[var(--border)] bg-[var(--card)] p-0 gap-0 shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
        <DialogHeader className="space-y-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-3 text-[var(--cc-text)]">
            <SolidListThumbTile thumb={theme.header} icon={LayoutTemplate} size="compact" />
            Customize Dashboard
          </DialogTitle>
          <DialogDescription className="text-[var(--cc-text-muted)]">
            Choose a preloaded template or toggle individual widgets. Your layout is saved for this role on this device.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-5 py-4 sm:px-6">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-[var(--cc-text)]">Templates</h4>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {templates.map((template) => {
                const active = layout.templateId === template.id
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => onApplyTemplate(template.id)}
                    className={cn(
                      "rounded-2xl border bg-[var(--card)] px-4 py-3 text-left transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
                      active
                        ? "border-2"
                        : "border-[var(--border)] hover:bg-[var(--muted)]/50",
                    )}
                    style={active ? { borderColor: theme.templateActive.border } : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--cc-text)]">{template.name}</span>
                      {active ? (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                          style={{
                            backgroundColor: theme.templateActive.badgeFill,
                            color: theme.templateActive.badgeText,
                          }}
                        >
                          Active
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-snug text-[var(--cc-text-muted)]">{template.description}</p>
                    <p
                      className="mt-2 text-[11px] font-semibold"
                      style={{ color: active ? theme.templateActive.count : "var(--cc-text-muted)" }}
                    >
                      {template.widgetIds.length} widgets
                    </p>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-[var(--cc-text)]">Widgets</h4>
              {activeTemplate ? (
                <span className="text-xs text-[var(--cc-text-muted)]">Based on {activeTemplate.name}</span>
              ) : null}
            </div>
            <div className="space-y-2">
              {eligible.map((widget, index) => {
                const visible = layout.visibleWidgetIds.includes(widget.id)
                const { thumb, icon: WidgetIcon } = widgetVisual(widget.id, index)
                const statusStyle = visible ? theme.widgetShown : theme.widgetHidden
                return (
                  <button
                    key={widget.id}
                    type="button"
                    onClick={() => onToggleWidget(widget.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-[var(--muted)]/40",
                      !visible && "opacity-90",
                    )}
                  >
                    <SolidListThumbTile thumb={thumb} icon={WidgetIcon} size="compact" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--cc-text)]">{widget.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">{widget.description}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
                      style={{ backgroundColor: statusStyle.fill, color: statusStyle.text }}
                    >
                      {visible ? "Shown" : "Hidden"}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2 border-t border-[var(--border)] px-5 py-4 sm:px-6 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            className="border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] hover:bg-[var(--muted)]"
          >
            <span
              className="mr-2 inline-flex size-6 items-center justify-center rounded-lg"
              style={{ backgroundColor: theme.reset.fill, color: theme.reset.icon }}
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            Reset to default
          </Button>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-white hover:opacity-90"
            style={{ backgroundColor: theme.templateActive.badgeFill }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function getVisibleWidgets(
  layout: DashboardLayoutState,
  portal: DashboardPortal,
  role: DashboardRoleKey,
): DashboardWidgetDef[] {
  const eligibleIds = new Set(getEligibleWidgets(portal, role).map((w) => w.id))
  return layout.visibleWidgetIds
    .map((id) => getWidgetDef(id))
    .filter((def): def is DashboardWidgetDef => !!def && eligibleIds.has(def.id))
}
