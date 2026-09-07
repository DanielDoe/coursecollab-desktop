/**
 * Dashboard KPI icon accents — distinct icon well hues for light + dark.
 */

import type { DashboardSemanticType } from "@/lib/appearance/component-recipes"

export type KpiAccentId =
  | "emerald"
  | "sky"
  | "violet"
  | "blue"
  | "orange"
  | "amber"
  | "rose"
  | "indigo"
  | "teal"
  | "cyan"
  | "fuchsia"
  | "lime"
  | "slate"

export type KpiAccentTokens = {
  iconWell: string
  icon: string
}

export const KPI_ACCENT: Record<KpiAccentId, KpiAccentTokens> = {
  emerald: {
    iconWell: "bg-emerald-500/10 dark:bg-emerald-400/12",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  sky: {
    iconWell: "bg-sky-500/10 dark:bg-sky-400/12",
    icon: "text-sky-600 dark:text-sky-400",
  },
  violet: {
    iconWell: "bg-violet-500/10 dark:bg-violet-400/12",
    icon: "text-violet-600 dark:text-violet-400",
  },
  blue: {
    iconWell: "bg-blue-500/10 dark:bg-blue-400/12",
    icon: "text-blue-600 dark:text-blue-400",
  },
  orange: {
    iconWell: "bg-orange-500/10 dark:bg-orange-400/12",
    icon: "text-orange-600 dark:text-orange-400",
  },
  amber: {
    iconWell: "bg-amber-500/10 dark:bg-amber-400/12",
    icon: "text-amber-600 dark:text-amber-400",
  },
  rose: {
    iconWell: "bg-rose-500/10 dark:bg-rose-400/12",
    icon: "text-rose-600 dark:text-rose-400",
  },
  indigo: {
    iconWell: "bg-indigo-500/10 dark:bg-indigo-400/12",
    icon: "text-indigo-600 dark:text-indigo-400",
  },
  teal: {
    iconWell: "bg-teal-500/10 dark:bg-teal-400/12",
    icon: "text-teal-600 dark:text-teal-400",
  },
  cyan: {
    iconWell: "bg-cyan-500/10 dark:bg-cyan-400/12",
    icon: "text-cyan-600 dark:text-cyan-400",
  },
  fuchsia: {
    iconWell: "bg-fuchsia-500/10 dark:bg-fuchsia-400/12",
    icon: "text-fuchsia-600 dark:text-fuchsia-400",
  },
  lime: {
    iconWell: "bg-lime-500/10 dark:bg-lime-400/12",
    icon: "text-lime-700 dark:text-lime-400",
  },
  slate: {
    iconWell: "bg-slate-500/10 dark:bg-slate-400/10",
    icon: "text-slate-600 dark:text-slate-400",
  },
}

export function kpiAccentFromSemantic(semantic: DashboardSemanticType): KpiAccentId {
  switch (semantic) {
    case "quiz":
      return "blue"
    case "homework":
      return "violet"
    case "attendance":
      return "teal"
    case "grades":
    case "primary":
      return "indigo"
    case "success":
      return "emerald"
    case "warning":
      return "amber"
    case "danger":
      return "rose"
    case "info":
      return "sky"
    case "analytics":
      return "orange"
    case "calendar":
      return "fuchsia"
    case "reward":
      return "lime"
    case "ai":
      return "fuchsia"
    case "codebench":
      return "cyan"
    case "discussion":
      return "violet"
    case "projects":
      return "indigo"
    case "neutral":
    default:
      return "slate"
  }
}

export function resolveKpiAccent(options: {
  accent?: KpiAccentId
  semantic?: DashboardSemanticType
}): KpiAccentTokens {
  const id = options.accent ?? (options.semantic ? kpiAccentFromSemantic(options.semantic) : "slate")
  return KPI_ACCENT[id]
}
