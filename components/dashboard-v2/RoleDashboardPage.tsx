"use client"

import { useMemo, useState } from "react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { STUDENT_CUSTOMIZE_THEME } from "@/lib/student-color-hunt-theme"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { useDashboardKpiGrid } from "@/hooks/use-dashboard-kpi-grid"
import { cn } from "@/lib/utils"
import {
  camperTitle,
  camperSubtitle,
  camperBody,
  camperSpinnerRing,
} from "@/lib/summer-camp/camper-ui-theme"
import {
  countHiddenKpis,
  kpiOverflowHint,
  sliceKpisForGrid,
} from "@/lib/dashboard-v2/kpi-layout"
import type { DashboardLayoutState, DashboardPortal } from "@/lib/dashboard-v2/types"
import { resolveDashboardRole } from "@/lib/dashboard-v2/resolve-role"
import {
  getDefaultLayout,
  getRoleDashboardSubtitle,
  getRoleDashboardTitle,
  getTemplatesForRole,
  layoutStorageKey,
} from "@/lib/dashboard-v2/widget-registry"
import { DashboardDataProvider, useDashboardData } from "./DashboardDataContext"
import { DashboardCustomizeDialog, getVisibleWidgets } from "./DashboardCustomizeDialog"
import { DashboardWidgetRenderer } from "./DashboardWidgetRenderer"
import { LazyMount } from "@/components/student/dashboard-v2/LazyMount"
import { StudentDashboardHero } from "@/components/student/dashboard-v2/StudentDashboardHero"
import { FacultyDashboardHero } from "@/components/instructor/dashboard-v2/FacultyDashboardHero"

function RoleDashboardInner({ portal }: { portal: DashboardPortal }) {
  const role = resolveDashboardRole(portal)
  const { loading } = useDashboardData()
  const kpiGrid = useDashboardKpiGrid()
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const storageKey = layoutStorageKey(portal, role)
  const [layout, setLayout] = usePersistedState<DashboardLayoutState>(
    storageKey,
    getDefaultLayout(role),
    "local",
  )

  const visibleWidgets = useMemo(
    () => getVisibleWidgets(layout, portal, role),
    [layout, portal, role],
  )

  const kpiWidgets = useMemo(
    () => visibleWidgets.filter((w) => w.kind === "kpi"),
    [visibleWidgets],
  )
  const visibleKpiWidgets = useMemo(
    () => sliceKpisForGrid(kpiWidgets, kpiGrid),
    [kpiWidgets, kpiGrid],
  )
  const hiddenKpiCount = countHiddenKpis(kpiWidgets.length, visibleKpiWidgets.length)
  const kpiOverflowMessage = kpiOverflowHint(hiddenKpiCount, kpiGrid.tier)
  const contentWidgets = useMemo(
    () => visibleWidgets.filter((w) => w.kind !== "kpi"),
    [visibleWidgets],
  )
  const fullContentWidgets = useMemo(
    () => contentWidgets.filter((w) => w.size === "full"),
    [contentWidgets],
  )
  const halfContentWidgets = useMemo(
    () => contentWidgets.filter((w) => w.size !== "full"),
    [contentWidgets],
  )

  const applyTemplate = (templateId: string) => {
    const template = getTemplatesForRole(role).find((t) => t.id === templateId)
    if (!template) return
    setLayout({ templateId, visibleWidgetIds: template.widgetIds })
  }

  const toggleWidget = (widgetId: string) => {
    setLayout((prev) => {
      const visible = prev.visibleWidgetIds.includes(widgetId)
      return {
        ...prev,
        visibleWidgetIds: visible
          ? prev.visibleWidgetIds.filter((id) => id !== widgetId)
          : [...prev.visibleWidgetIds, widgetId],
      }
    })
  }

  const resetLayout = () => setLayout(getDefaultLayout(role))

  if (loading && portal !== "student" && portal !== "faculty") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className={cn("w-10 h-10 mx-auto mb-4", camperSpinnerRing)} />
          <p className={camperBody}>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={portal === "student" || portal === "faculty" ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: portal === "student" || portal === "faculty" ? 0 : 0.5 }}
      className="space-y-4 sm:space-y-6"
    >
      {portal === "student" ? (
        <StudentDashboardHero onCustomize={() => setCustomizeOpen(true)} />
      ) : portal === "faculty" ? (
        <FacultyDashboardHero onCustomize={() => setCustomizeOpen(true)} />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className={cn("text-2xl sm:text-3xl font-bold tracking-tight", camperTitle)}>
                {getRoleDashboardTitle(role, portal)}
              </h1>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 shrink-0 rounded-full border-0 shadow-sm hover:opacity-90"
                style={{
                  backgroundColor: STUDENT_CUSTOMIZE_THEME.trigger.fill,
                  color: STUDENT_CUSTOMIZE_THEME.trigger.icon,
                }}
                onClick={() => setCustomizeOpen(true)}
                title="Customize dashboard"
              >
                <Settings2 className="h-4 w-4" strokeWidth={2} aria-hidden />
              </Button>
            </div>
            <p className={cn("mt-1 text-sm", camperSubtitle)}>
              {getRoleDashboardSubtitle(role, portal)}
            </p>
          </div>
        </div>
      )}

      {visibleWidgets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-white/15">
          <p className="font-medium text-slate-800 dark:text-slate-200">No widgets selected</p>
          <p className="text-sm text-slate-500 mt-1">Use the gear button to choose a template or enable widgets.</p>
          <Button className="mt-4" onClick={() => setCustomizeOpen(true)}>
            Customize dashboard
          </Button>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {kpiWidgets.length > 0 ? (
            <div className="space-y-2">
              <div className={kpiGrid.gridClass}>
                {visibleKpiWidgets.map((widget, i) => (
                  <motion.div
                    key={widget.id}
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.015 }}
                    className="flex h-full min-w-0 w-full"
                  >
                    <DashboardWidgetRenderer widgetId={widget.id} />
                  </motion.div>
                ))}
              </div>
              {kpiOverflowMessage ? (
                <p className="text-center text-xs text-slate-500 dark:text-slate-400 px-2">
                  {kpiOverflowMessage}
                </p>
              ) : null}
            </div>
          ) : null}

          {contentWidgets.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              {fullContentWidgets.map((widget, i) => (
                <LazyMount key={widget.id} minHeight={280} className="lg:col-span-2">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.04 }}
                  >
                    <DashboardWidgetRenderer widgetId={widget.id} />
                  </motion.div>
                </LazyMount>
              ))}

              {halfContentWidgets.length > 0 ? (
                <div className="grid grid-cols-1 items-stretch gap-3 sm:gap-4 lg:grid-cols-2">
                  {halfContentWidgets.map((widget, i) => (
                    <LazyMount key={widget.id} minHeight={280} className="h-full min-w-0">
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: i * 0.04 }}
                        className="h-full"
                      >
                        <DashboardWidgetRenderer widgetId={widget.id} />
                      </motion.div>
                    </LazyMount>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <DashboardCustomizeDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        portal={portal}
        role={role}
        layout={layout}
        onApplyTemplate={applyTemplate}
        onToggleWidget={toggleWidget}
        onReset={resetLayout}
      />
    </motion.div>
  )
}

export function RoleDashboardPage({ portal }: { portal: DashboardPortal }) {
  return (
    <DashboardDataProvider portal={portal}>
      <RoleDashboardInner portal={portal} />
    </DashboardDataProvider>
  )
}
