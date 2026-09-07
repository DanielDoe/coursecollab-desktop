/**
 * Module id → semantic role mapping.
 * Single source of truth for dashboard, sidebar, charts, and page chrome.
 */

import type { SemanticRole } from "@/lib/appearance/semantic-tokens"

export const MODULE_SEMANTIC_ROLE: Record<string, SemanticRole> = {
  dashboard: "primary",
  lectures: "info",
  "course-notes": "info",
  flashcards: "practice",
  sections: "calendar",
  "ai-notetaker": "ai",
  practice: "practice",
  "ai-tutor": "ai",
  codebench: "codebench",
  "codebench-more": "analytics",
  quizzes: "quiz",
  "quiz-history": "quiz",
  "question-bank": "quiz",
  homework: "homework",
  homeworks: "homework",
  "mid-semester": "quiz",
  "mid-semester-exams": "quiz",
  "final-exams": "quiz",
  "course-evaluations": "info",
  grades: "primary",
  forum: "discussion",
  messages: "messages",
  groups: "messages",
  projects: "projects",
  playground: "practice",
  "classroom-points": "reward",
  attendance: "attendance",
  "trade-center": "reward",
  announcements: "info",
  "progress-review": "analytics",
  syllabus: "info",
  "summer-camp": "calendar",
  "course-evaluation": "info",
  calendar: "calendar",
  "office-hours": "calendar",
  "course-policies": "neutral",
  recommendations: "info",
  membership: "reward",
  "help-center": "neutral",
  "submit-ticket": "neutral",
  "report-bug": "danger",
  "feature-requests": "ai",
  settings: "neutral",
  purchases: "neutral",
  "camp-dashboard": "reward",
  "my-trainings": "ai",
  "browse-trainings": "calendar",
  "learning-roadmap": "practice",
  "camp-projects": "projects",
  checkpoints: "quiz",
  "discussions-help": "discussion",
  resources: "info",
  achievements: "reward",
  "camp-calendar": "calendar",
  "camp-announcements": "info",
  "camp-support": "neutral",
}

export const NAV_GROUP_SEMANTIC_ROLE: Record<string, SemanticRole> = {
  "learning-center": "practice",
  assessments: "homework",
  collaboration: "messages",
  "performance-rewards": "reward",
  "course-info": "calendar",
  support: "neutral",
  dashboard: "primary",
  course: "info",
  "course-support": "info",
  students: "messages",
  instructors: "ai",
  users: "messages",
  academic: "calendar",
  finance: "reward",
  system: "neutral",
  analytics: "analytics",
  communication: "messages",
  administration: "reward",
  "course-administration": "reward",
  settings: "neutral",
  assessments_faculty: "quiz",
}

/** Legacy PortalColorFamily → semantic (backward compat for themeFromFamily) */
export const FAMILY_SEMANTIC_ROLE: Record<string, SemanticRole> = {
  brand: "primary",
  sky: "calendar",
  amber: "reward",
  violet: "ai",
  blue: "codebench",
  purple: "quiz",
  indigo: "ai",
  teal: "messages",
  rose: "attendance",
  emerald: "success",
  orange: "homework",
  slate: "neutral",
}

export function resolveModuleSemanticRole(moduleId: string, navGroupId?: string): SemanticRole {
  return (
    MODULE_SEMANTIC_ROLE[moduleId] ??
    (navGroupId ? NAV_GROUP_SEMANTIC_ROLE[navGroupId] : undefined) ??
    "primary"
  )
}

/** Sidebar + page chrome: one semantic color per accordion group */
export function resolveNavGroupSemanticRole(navGroupId: string): SemanticRole {
  return NAV_GROUP_SEMANTIC_ROLE[navGroupId] ?? "primary"
}

/** Prefer module-specific semantic (e.g. trade-center → reward) over accordion group default */
export function resolveGroupedModuleSemanticRole(
  moduleId: string,
  navGroupId?: string,
): SemanticRole {
  if (MODULE_SEMANTIC_ROLE[moduleId]) {
    return MODULE_SEMANTIC_ROLE[moduleId]
  }
  if (navGroupId && NAV_GROUP_SEMANTIC_ROLE[navGroupId]) {
    return NAV_GROUP_SEMANTIC_ROLE[navGroupId]
  }
  return "primary"
}

export function resolveFamilySemanticRole(family: string): SemanticRole {
  return FAMILY_SEMANTIC_ROLE[family] ?? "primary"
}
