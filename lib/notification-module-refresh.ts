"use client"

import { useEffect } from "react"

export type NotificationModule =
  | "dashboard"
  | "messages"
  | "announcements"
  | "assessments"
  | "grades"
  | "groups"
  | "projects"
  | "lectures"
  | "forum"
  | "classroom-points"
  | "calendar"
  | "office-hours"
  | "recommendations"
  | "progress-review"
  | "course-evaluation"
  | "issues"
  | "membership"
  | "practice"
  | "notes"
  | "flashcards"
  | "attendance"
  | "ai-tutor"
  | "codebench"
  | "ai-notetaker"
  | "trade-center"

type VoidListener = () => void

const moduleListeners = new Map<NotificationModule, Set<VoidListener>>()

export function notificationTypeToModules(type: unknown, link?: string | null): NotificationModule[] {
  const normalized = typeof type === "string" ? type.toLowerCase() : ""
  const linkLower = (link ?? "").toLowerCase()
  const modules = new Set<NotificationModule>()

  if (normalized.includes("announce")) {
    modules.add("announcements")
    modules.add("dashboard")
    return [...modules]
  }

  if (
    normalized === "quiz" ||
    normalized === "homework" ||
    normalized === "exam" ||
    normalized === "deadline" ||
    normalized.includes("assessment")
  ) {
    modules.add("assessments")
    modules.add("dashboard")
  }

  if (normalized === "grade" || linkLower.includes("/results/") || linkLower.includes("/grades")) {
    modules.add("grades")
    modules.add("assessments")
    modules.add("dashboard")
  }

  if (normalized === "group") modules.add("groups")
  if (normalized === "project") modules.add("projects")
  if (normalized === "lecture") modules.add("lectures")
  if (normalized === "forum") modules.add("forum")
  if (normalized === "code_submission" || linkLower.includes("classroom-points")) modules.add("classroom-points")
  if (normalized === "office_hours" || linkLower.includes("office-hours")) modules.add("office-hours")
  if (normalized.includes("recommendation")) modules.add("recommendations")
  if (normalized.includes("progress_review") || linkLower.includes("progress-review")) modules.add("progress-review")
  if (normalized === "practice") modules.add("practice")
  if (normalized === "note" || normalized.includes("notes")) modules.add("notes")
  if (normalized === "flashcard") modules.add("flashcards")
  if (normalized === "attendance") modules.add("attendance")
  if (normalized === "membership" || normalized === "donation") modules.add("membership")
  if (linkLower.includes("/lectures")) modules.add("lectures")

  if (modules.size === 0) modules.add("dashboard")
  return [...modules]
}

export function emitModuleRefresh(modules: NotificationModule | NotificationModule[]) {
  const list = Array.isArray(modules) ? modules : [modules]
  for (const module of list) {
    moduleListeners.get(module)?.forEach((listener) => listener())
  }
}

export function onModuleRefresh(module: NotificationModule, listener: VoidListener): () => void {
  let set = moduleListeners.get(module)
  if (!set) {
    set = new Set()
    moduleListeners.set(module, set)
  }
  set.add(listener)
  return () => set!.delete(listener)
}

/** Refresh a screen when a push/poll notification targets its module (mobile parity). */
export function useNotificationModuleRefresh(
  modules: NotificationModule | NotificationModule[],
  onRefresh: () => void | Promise<void>,
) {
  useEffect(() => {
    const list = Array.isArray(modules) ? modules : [modules]
    const unsubs = list.map((module) =>
      onModuleRefresh(module, () => {
        void onRefresh()
      }),
    )
    return () => {
      for (const unsub of unsubs) unsub()
    }
  }, [modules, onRefresh])
}
