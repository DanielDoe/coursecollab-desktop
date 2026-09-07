/**
 * Client-safe Practice Hub badge catalog (no DB imports).
 * Earned rows from `practice_badges.badge_type` unlock matching ids.
 */

import type { LucideIcon } from "lucide-react"
import {
  Award,
  Flame,
  Star,
  Target,
  Trophy,
  Zap,
  BookOpen,
  Crown,
  Sparkles,
  Medal,
  Rocket,
  CheckCircle2,
} from "lucide-react"

export type PracticeBadgeDef = {
  id: string
  name: string
  description: string
  /** Matches practice_badges.badge_type when present */
  types: string[]
  icon: LucideIcon
  category: "milestone" | "streak" | "excellence" | "progress"
}

export const PRACTICE_BADGE_DEFINITIONS: PracticeBadgeDef[] = [
  {
    id: "first_steps",
    name: "First Steps",
    description: "Complete your first Practice Hub session",
    types: ["first_steps", "first_session", "beginner"],
    icon: Rocket,
    category: "milestone",
  },
  {
    id: "warm_up",
    name: "Warm-Up",
    description: "Finish 5 practice sessions",
    types: ["warm_up", "sessions_5"],
    icon: BookOpen,
    category: "milestone",
  },
  {
    id: "dedicated",
    name: "Dedicated",
    description: "Complete 15 practice sessions",
    types: ["dedicated", "sessions_15"],
    icon: Medal,
    category: "progress",
  },
  {
    id: "century_club",
    name: "Century Club",
    description: "Answer 100 practice questions",
    types: ["century", "century_club", "questions_100"],
    icon: Target,
    category: "progress",
  },
  {
    id: "sharpshooter",
    name: "Sharpshooter",
    description: "Score 90% or higher on a session",
    types: ["sharpshooter", "high_score"],
    icon: Zap,
    category: "excellence",
  },
  {
    id: "perfectionist",
    name: "Perfectionist",
    description: "Earn a perfect 100% on a practice session",
    types: ["perfectionist", "perfect_score"],
    icon: Star,
    category: "excellence",
  },
  {
    id: "streak_3",
    name: "On a Roll",
    description: "Practice 3 days in a row",
    types: ["streak_3", "streak_three"],
    icon: Flame,
    category: "streak",
  },
  {
    id: "streak_7",
    name: "Week Warrior",
    description: "Keep a 7-day practice streak",
    types: ["streak_7", "streak_week"],
    icon: Flame,
    category: "streak",
  },
  {
    id: "topic_master",
    name: "Topic Master",
    description: "Clear every unlocked question in a topic",
    types: ["topic_master", "topic_complete"],
    icon: CheckCircle2,
    category: "milestone",
  },
  {
    id: "top_ten",
    name: "Top Ten",
    description: "Reach the top 10 on the practice leaderboard",
    types: ["top_ten"],
    icon: Trophy,
    category: "excellence",
  },
  {
    id: "podium",
    name: "Podium Finish",
    description: "Rank in the top 3 on the practice leaderboard",
    types: ["podium", "top_three"],
    icon: Crown,
    category: "excellence",
  },
  {
    id: "collector",
    name: "Badge Collector",
    description: "Unlock 5 practice badges",
    types: ["collector", "badge_collector"],
    icon: Sparkles,
    category: "progress",
  },
  {
    id: "practice_ace",
    name: "Practice Ace",
    description: "A standout achievement from Practice Hub",
    types: ["practice_ace", "ace", "award", "excellence", "milestone", "streak"],
    icon: Award,
    category: "excellence",
  },
]

export type PracticeEarnedBadge = {
  badge_type?: string
  badge_name?: string
  badge_description?: string
  earned_at?: string
}

export type PracticeBadgeView = PracticeBadgeDef & {
  unlocked: boolean
  unlockedAt?: string
  earnedName?: string
  earnedDescription?: string
}

/** Merge catalog with earned `practice_badges` rows (by badge_type). */
export function mergePracticeBadges(earned: PracticeEarnedBadge[]): PracticeBadgeView[] {
  const byType = new Map<string, PracticeEarnedBadge>()
  for (const row of earned) {
    const key = String(row.badge_type || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
    if (!key) continue
    if (!byType.has(key)) byType.set(key, row)
  }

  const matchedTypes = new Set<string>()
  const views: PracticeBadgeView[] = PRACTICE_BADGE_DEFINITIONS.map((def) => {
    let earnedRow: PracticeEarnedBadge | undefined
    for (const t of def.types) {
      const key = t.toLowerCase()
      const hit = byType.get(key)
      if (hit) {
        earnedRow = hit
        matchedTypes.add(key)
        break
      }
    }
    return {
      ...def,
      unlocked: Boolean(earnedRow),
      unlockedAt: earnedRow?.earned_at,
      earnedName: earnedRow?.badge_name,
      earnedDescription: earnedRow?.badge_description,
    }
  })

  // Surface unknown DB badges so nothing earned is hidden.
  for (const [type, row] of byType) {
    if (matchedTypes.has(type)) continue
    views.push({
      id: `earned_${type}`,
      name: row.badge_name || type.replace(/_/g, " "),
      description: row.badge_description || "Practice Hub achievement",
      types: [type],
      icon: Award,
      category: "milestone",
      unlocked: true,
      unlockedAt: row.earned_at,
      earnedName: row.badge_name,
      earnedDescription: row.badge_description,
    })
  }

  return views
}
